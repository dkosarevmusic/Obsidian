import os
import re
import collections
import shutil
from pathlib import Path
from datetime import datetime
from urllib.parse import unquote, quote as url_quote

# ================== CONFIGURATION ==================
# Укажите АБСОЛЮТНЫЙ путь к вашему хранилищу Obsidian
# Пример для Windows: "C:/Users/User/Documents/MyVault"
# Пример для macOS/Linux: "/home/user/MyVault". Рекомендуется использовать / вместо \.
VAULT_PATH = "C:\Obsidian\dkosarevmusic"

# Имя файла (с расширением .md), с которого начнется поиск.
# Скрипт найдет его в любой подпапке хранилища.
START_FILE_NAME = "DVFU.md"

RESULTS_FILE_NAME = "BFS_report.md"
# ===================================================

# Регулярное выражение для поиска ссылок в формате [text](link.md)
# 2. [text](link.md) or ![embed](link.md)
INLINE_RE = re.compile(r'\[.*?\]\(([^)\s#?]+)')


def build_file_index(vault_path: Path) -> dict[str, Path]:
    """
    Создает индекс всех файлов в хранилище для быстрого разрешения ссылок.
    Ключ - имя файла (e.g., 'My Note.md'), значение - полный путь (Path object).
    """
    index = {}
    for root, _, files in os.walk(vault_path):
        for file in files:
            # Используем normcase для регистронезависимого сравнения на Windows
            index[os.path.normcase(file)] = Path(root) / file
    return index

def find_file_in_vault(file_index: dict[str, Path], file_name: str) -> Path | None:
    """Ищет файл в индексе, пробуя разные варианты имени."""
    # Сначала ищем точное совпадение
    path = file_index.get(os.path.normcase(file_name))
    if path:
        return path
    # Если у имени нет расширения, пробуем добавить .md
    if not file_name.lower().endswith('.md'):
        path = file_index.get(os.path.normcase(f"{file_name}.md"))
        if path:
            return path
    return None

def _clean_markdown_body(body: str) -> str:
    """
    Ранее эта функция удаляла блоки кода и комментарии.
    Сейчас она возвращает текст без изменений для максимального охвата ссылок,
    чтобы избежать случайного пропуска связанных файлов.
    """
    return body

def _parse_links_from_text(text: str, current_dir: Path, file_index: dict[str, Path]) -> set[Path]:
    """
    Извлекает все исходящие ссылки из предоставленного ТЕКСТА.
    Возвращает набор абсолютных путей (Path objects) к связанным файлам.
    """
    links = set()
    cleaned_body = _clean_markdown_body(text)

    # Сначала находим все содержимое [[...]], а затем парсим его.
    wikilink_re = re.compile(r'\[\[(.*?)\]\]')
    for match in wikilink_re.finditer(cleaned_body):
        full_link_text = match.group(1)

        # Отделяем алиас (текст после |)
        link_part = full_link_text.split('|', 1)[0]
        # Отделяем заголовок (текст после #) и ID блока (текст после ^)
        file_part = link_part.split('#', 1)[0].split('^', 1)[0]

        # Убираем лишние пробелы и ищем файл
        decoded_link = unquote(file_part.strip())
        if not decoded_link:  # Пропускаем пустые ссылки типа [[|alias]]
            continue

        target_path = find_file_in_vault(file_index, decoded_link)
        if target_path and target_path.exists():
            links.add(target_path)

    # 2. Обработка Inline-ссылок
    for match in INLINE_RE.finditer(cleaned_body):
        raw_link = match.group(1).strip()
        # current_dir = file_path.parent
        
        # Декодируем URL-кодированные символы (например, %20 -> пробел)
        decoded_link = unquote(raw_link)

        # Сначала пробуем разрешить как относительный путь
        potential_path = (current_dir / decoded_link).resolve()

        if potential_path.is_file() and potential_path.exists():
            links.add(potential_path)
        else:  # Если не получилось, ищем по имени файла во всем хранилище
            file_name_only = Path(decoded_link).name
            target_path = find_file_in_vault(file_index, file_name_only)
            if target_path and target_path.exists():
                links.add(target_path)
                
    return links

def parse_file_links(file_path: Path, file_index: dict[str, Path]) -> dict[str, set[Path]]:
    """
    Читает файл один раз и извлекает ссылки из его frontmatter и тела.
    Возвращает словарь с двумя наборами ссылок: {'frontmatter': set(), 'body': set()}.
    """
    results = {'frontmatter': set(), 'body': set()}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return results

    frontmatter = ""
    body = ""
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) > 1:
            frontmatter = parts[1]
        if len(parts) > 2:
            body = parts[2]
    else:
        body = content

    if frontmatter:
        results['frontmatter'] = _parse_links_from_text(frontmatter, file_path.parent, file_index)
    if body:
        results['body'] = _parse_links_from_text(body, file_path.parent, file_index)
        
    return results

def build_link_maps(vault_path: Path, file_index: dict[str, Path]) -> tuple[dict, dict]:
    """
    Сканирует хранилище один раз для построения двух карт:
    1. forward_graph: {source_file: {'body': {links}, 'frontmatter': {links}}}
    2. backlinks_map (только для frontmatter): {target_file: {sources}}
    """
    print("🔄 Сканирование хранилища и построение карты ссылок...")
    forward_graph = {}
    backlinks_map = collections.defaultdict(set)
    all_md_files = list(vault_path.rglob('*.md'))
    
    for i, source_path in enumerate(all_md_files):
        if (i + 1) % 500 == 0 or i + 1 == len(all_md_files):
            print(f"  - Просканировано {i+1}/{len(all_md_files)} файлов...")
        
        all_links = parse_file_links(source_path, file_index)
        forward_graph[source_path.resolve()] = all_links
        
        for target_path in all_links.get('frontmatter', set()):
            backlinks_map[target_path.resolve()].add(source_path.resolve())
    print(f"✅ Карта ссылок создана. Обработано {len(forward_graph)} файлов.")
    return forward_graph, backlinks_map

def perform_bfs(start_file_path: Path, vault: Path, forward_graph: dict, backlinks_map: dict) -> tuple[dict, list]:
    """
    Выполняет обход в ширину (BFS) от стартового файла.
    Возвращает словарь посещенных файлов (path -> level) и список ошибок.
    """
    print(f"🚀 Начинаем обход в ширину (BFS) от '{start_file_path.name}'...")
    queue = collections.deque([(start_file_path, 0, None)]) # path, level, parent_path
    visited = {}  # path -> {'level': level, 'parent': parent_path}
    errors = []
    
    while queue:
        current_path, level, parent_path = queue.popleft()
        current_path = current_path.resolve()
        if current_path in visited:
            continue
        
        visited[current_path] = {'level': level, 'parent': parent_path}
        print(f"  - Обработка ({len(visited)}): {current_path.relative_to(vault)}")

        # 1. Ищем ИСХОДЯЩИЕ ссылки из ТЕЛА (из пред-построенной карты)
        file_links = forward_graph.get(current_path.resolve(), {})
        out_links_from_body = file_links.get("body", set())
        for link in out_links_from_body:
            if link.resolve() not in visited:
                queue.append((link, level + 1, current_path))
        
        # 2. Ищем ВХОДЯЩИЕ ссылки из FRONTMATTER'а других файлов
        in_links_from_frontmatter = backlinks_map.get(current_path.resolve(), set())
        for link_source in in_links_from_frontmatter:
            if link_source.resolve() not in visited:
                queue.append((link_source, level + 1, current_path))

    print(f"\n✅ Обход завершен. Найдено {len(visited)} связанных файлов.")
    return visited, errors


def _create_obsidian_link(file_path: Path, vault: Path) -> str:
    """Создает кликабельную wikilink-ссылку для Obsidian."""
    # Получаем относительный путь и используем прямые слэши
    relative_path_str = file_path.relative_to(vault).as_posix()
    
    # Убираем расширение .md для markdown-файлов
    if relative_path_str.lower().endswith('.md'):
        link_text = relative_path_str[:-3]
    else:
        link_text = relative_path_str
        
    return f"[[{link_text}]]"


def generate_report_body(levels: dict, vault: Path) -> str:
    """Генерирует тело отчета со структурированным списком файлов."""
    report_lines = []
    report_lines.append("## 📂 Файлы по уровням (ссылки для Obsidian)\n\n")
    report_lines.append("Файлы сгруппированы по источнику, из которого на них ссылаются.\n\n")

    for level in sorted(levels.keys()):
        report_lines.append(f"### Уровень {level}\n")
        
        # Сортируем родительские файлы для консистентного вывода
        # None (для стартового файла) должен идти первым
        parents_at_level = sorted(levels[level].keys(), key=lambda p: (p is None, str(p)), reverse=True)
        for parent_path in parents_at_level:
            child_paths = sorted(levels[level][parent_path])

            if parent_path is None:
                # Это стартовый файл на уровне 0
                for file_path in child_paths:
                    report_lines.append(f"- **Стартовый файл:** {_create_obsidian_link(file_path, vault)}\n")
            else:
                # Файлы, связанные с определенного родителя
                report_lines.append(f"- Связаны из **{_create_obsidian_link(parent_path, vault)}**:\n")
                for file_path in child_paths:
                    report_lines.append(f"  - {_create_obsidian_link(file_path, vault)}\n")
        report_lines.append("\n")
    
    return "".join(report_lines)


def handle_report_mode(f, report_body: str):
    """Записывает в файл отчет для режима 'report'."""
    f.write(report_body)


def handle_archive_mode(f, visited: dict, levels: dict, vault: Path, start_file_name: str):
    """Выполняет архивацию и записывает отчеты для режима 'archive'."""
    # --- Часть 1: Запись краткого отчета в results.md ---
    f.write("## 🗄️ Архивированные файлы\n\n")

    # Создаем путь к архиву
    # 1. Основная папка "Archive" рядом с хранилищем
    main_archive_dir = vault.parent / "Archive"

    # 2. Внутри нее - папка для конкретного запуска, основанная на стартовом файле
    start_file_stem = Path(start_file_name).stem
    run_archive_path = main_archive_dir / f"{start_file_stem} Archive"

    os.makedirs(run_archive_path, exist_ok=True)
    f.write(f"**Файлы перемещены в:** `{run_archive_path}`\n\n")

    archived_count = 0
    archive_errors = []
    all_files_to_archive = sorted(list(visited.keys()))

    for file_path in all_files_to_archive:
        rel_path = file_path.relative_to(vault)
        rel_path_str = rel_path.as_posix()

        if file_path.name == RESULTS_FILE_NAME:
            f.write(f"- `{rel_path_str}` - ⚠️ Пропущен (этот файл отчета)\n")
            continue
        
        destination_path = run_archive_path / rel_path
        os.makedirs(destination_path.parent, exist_ok=True)

        try:
            shutil.move(str(file_path), str(destination_path))
            f.write(f"- `{rel_path_str}` - ✅ Архивирован\n")
            print(f"  - Архивирован: {rel_path_str}")
            archived_count += 1
        except Exception as e:
            error_msg = f"Не удалось архивировать {rel_path_str}: {e}"
            archive_errors.append(error_msg)
            f.write(f"- `{rel_path_str}` - ❌ Ошибка архивации\n")
            print(f"  ⚠️  {error_msg}")
    
    f.write(f"\n**Итог: архивировано {archived_count} из {len(all_files_to_archive)} файлов.**\n\n")
    if archive_errors:
        f.write("### ⚠️ Ошибки архивации\n\n")
        for err in archive_errors:
            f.write(f"- `{err}`\n")

    # --- Часть 2: Запись подробного лога в папку архива ---
    archive_log_path = run_archive_path / "_archive_log.md"
    log_content = []
    
    # Генерация подробного отчета о связях
    report_body = generate_report_body(levels, vault)

    log_content.append("---\n")
    log_content.append("tags:\n")
    log_content.append("  - optimization\n")
    log_content.append("  - cleanup\n")
    log_content.append("---\n\n")

    log_content.append(f"# Архив от {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    log_content.append(f"**Операция:** Архивирование (BFS)\n")
    log_content.append(f"**Стартовый файл:** `{start_file_name}`\n\n")
    log_content.append(f"**Всего найдено и заархивировано:** {len(visited)} файлов\n\n")
    log_content.append(report_body)

    try:
        # Используем 'w' (write), так как для каждого запуска создается свой уникальный лог
        with open(archive_log_path, 'w', encoding='utf-8') as log_f:
            log_f.writelines(log_content)
        print(f"✅ Лог операции сохранен в: {archive_log_path}")
    except Exception as e:
        print(f"❌ Критическая ошибка при записи лога архивации: {e}")


def main(mode: str):
    """Главная функция скрипта."""
    vault = Path(VAULT_PATH)
    if not vault.is_dir():
        print(f"❌ Ошибка: Указанный путь к хранилищу не существует или не является папкой: {VAULT_PATH}")
        return

    print("🔄 Создание индекса файлов хранилища...")
    file_index = build_file_index(vault)
    forward_graph, backlinks_map = build_link_maps(vault, file_index)
    
    start_file_path = find_file_in_vault(file_index, START_FILE_NAME)
    if not start_file_path:
        print(f"❌ Ошибка: Стартовый файл '{START_FILE_NAME}' не найден в хранилище '{VAULT_PATH}'.")
        print("Проверьте переменные START_FILE_NAME и VAULT_PATH.")
        return

    # 1. Выполняем поиск файлов
    visited, errors = perform_bfs(start_file_path, vault, forward_graph, backlinks_map)

    # 2. Группируем найденные файлы по уровням вложенности и родителям
    levels = collections.defaultdict(lambda: collections.defaultdict(list))
    for path, data in visited.items():
        level = data['level']
        parent = data['parent']
        levels[level][parent].append(path)

    # 3. Создаем файл отчета
    results_path = vault / RESULTS_FILE_NAME
    try:
        with open(results_path, 'w', encoding='utf-8') as f:
            # Записываем YAML frontmatter
            f.write("---\n")
            f.write("tags:\n")
            f.write("  - optimization\n")
            f.write("  - cleanup\n")
            f.write("---\n\n")

            # Записываем общую информацию
            f.write(f"# Результаты обхода от {START_FILE_NAME}\n\n")
            f.write(f"**Режим:** `{mode}`\n")
            f.write(f"**Всего найдено файлов:** {len(visited)}\n\n")

            # Выполняем действие в зависимости от режима
            if mode == 'report':
                report_body = generate_report_body(levels, vault)
                handle_report_mode(f, report_body)
            elif mode == 'archive':
                # В режиме архивации, функция сама запишет и краткий отчет в f,
                # и подробный лог в папку архива.
                handle_archive_mode(f, visited, levels, vault, START_FILE_NAME)

            # Записываем ошибки, если они были
            if errors:
                f.write("## ⚠️ Ошибки обхода\n\n")
                for err in errors:
                    f.write(f"- `{err}`\n")
            elif mode == 'report':
                 f.write("✅ Ошибок при обходе не было.\n")

        print(f"\n✅ Отчет сохранен в: {results_path}")

    except Exception as e:
        print(f"❌ Критическая ошибка при записи файла результатов: {e}")

def run_interactive():
    """Запускает скрипт в интерактивном режиме с выбором действия."""
    while True:
        print("\nВыберите режим работы:")
        print("  1. 📝 Создать отчет (безопасный режим)")
        print("  2. 🗄️  Архивировать файлы (опасный режим, перемещает файлы!)")
        print("  3. 🚪 Выход")
        
        choice = input("Введите номер варианта (1-3): ").strip()

        if choice == '1':
            main(mode='report')
            break
        elif choice == '2':
            print("\n🛑 ВНИМАНИЕ! Режим 'archive' ПЕРЕМЕСТИТ все найденные файлы в папку архива.")
            confirm = input("   Вы уверены, что хотите продолжить? (введите 'yes' для подтверждения): ").strip().lower()
            if confirm == 'yes':
                main(mode='archive')
            else:
                print("Отмена операции.")
            break
        elif choice == '3':
            print("Выход из программы.")
            break
        else:
            print("❌ Неверный ввод. Пожалуйста, выберите 1, 2 или 3.")

if __name__ == "__main__":
    run_interactive()
