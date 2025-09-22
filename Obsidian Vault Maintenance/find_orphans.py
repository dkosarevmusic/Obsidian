import os
import re
import collections
import json
import time
import hashlib
from pathlib import Path
from urllib.parse import unquote

# ================== CONFIGURATION ==================
# Укажите АБСОЛЮТНЫЙ путь к вашему хранилищу Obsidian
# Пример для Windows: "C:/Users/User/Documents/MyVault"
# Пример для macOS/Linux: "/home/user/MyVault". Рекомендуется использовать / вместо \.
VAULT_PATH = "C:/Obsidian/dkosarevmusic"

REPORT_FILE_NAME = "orphans_report.md"
CACHE_FILE_NAME = ".find_orphans_cache.json"

# Папки, которые нужно полностью игнорировать при сканировании.
# Указывайте пути относительно корня хранилища, используя '/' в качестве разделителя.
# Например: ["_templates", "resources/attachments"]
IGNORED_FOLDERS = [
    "Excalidraw", "Templates", "JS Scripts"
]
# Игнорировать ли файлы в корневой папке хранилища (но продолжать сканировать подпапки).
# True - да, игнорировать файлы в корне. False - нет, сканировать как обычно.
IGNORE_ROOT_FILES = True
# ===================================================

# Свойства в frontmatter, которые могут содержать ссылки в виде простого текста.
# Скрипт будет рассматривать значение этих свойств как потенциальную ссылку на файл.
# Пример: `banner: "attachments/image.png"`
FRONTMATTER_LINK_PROPERTIES = [
    "banner",
    "image",
]

# --- Вспомогательные функции (аналогичные предыдущему скрипту) ---

# Регулярные выражения для поиска ссылок
WIKI_RE = re.compile(r'\[\[([^\]\|#]+)')
INLINE_RE = re.compile(r'\[.*?\]\(([^)\s#?]+)')
# Регулярные выражения для анализа "виртуальных" ссылок
QUERY_BLOCK_RE = re.compile(r'```(?:dataview|base).*?\n(.*?)\n```', re.DOTALL | re.IGNORECASE)
# Ищет `wikilinks.contains(link("..."))` и `wikilinks.contains(link(this.file.name))`
DATAVIEW_FILTER_RE = re.compile(r'wikilinks\.contains\(link\((?:"([^"]+)"|this\.file\.name)\)\)')
FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---', re.DOTALL)
FM_WIKILINKS_SECTION_RE = re.compile(r'^wikilinks:(.*?)(?=\n^\S|\Z)', re.MULTILINE | re.DOTALL)
FM_WIKILINK_ITEM_RE = re.compile(r'\[\[([^\]\|#]+)\]\]')

def _get_script_hash() -> str:
    """Вычисляет хэш SHA256 текущего файла скрипта для автоматической инвалидации кэша."""
    try:
        with open(__file__, 'rb') as f:
            script_content = f.read()
        return hashlib.sha256(script_content).hexdigest()
    except Exception:
        # Резервный вариант на случай ошибки хеширования, гарантирующий повторный анализ.
        return str(time.time())


def build_file_index(vault_path: Path, ignored_folders: list[str], cache_file_name: str, report_file_name: str, ignore_root_files: bool) -> dict[str, Path]:
    """
    Создает индекс всех файлов в хранилище для быстрого разрешения ссылок.
    Ключ - имя файла (e.g., 'My Note.md'), значение - полный путь (Path object).
    Использует os.scandir для максимальной производительности.
    """
    index = {}
    # Нормализуем пути игнорируемых папок для надежного сравнения.
    # Приводим к нижнему регистру и используем '/' в качестве разделителя.
    ignored_paths_normalized = {p.strip().lower().replace("\\", "/") for p in ignored_folders}

    def scan_recursively(current_path: Path):
        """Рекурсивно сканирует директории с помощью os.scandir."""
        # Проверяем, не находится ли текущая директория в списке игнорируемых.
        # relative_to() для корневой папки возвращает '.', поэтому обрабатываем его отдельно.
        relative_path = current_path.relative_to(vault_path)
        current_relative_posix = relative_path.as_posix().lower()
        
        # Игнорируем папку, если она есть в списке. Пропускаем '.', чтобы случайно не проигнорировать все хранилище.
        if current_relative_posix != '.' and current_relative_posix in ignored_paths_normalized:
            return

        is_root_folder = (current_path == vault_path)

        try:
            for entry in os.scandir(current_path):
                # Игнорируем скрытые файлы и папки (начинающиеся с точки)
                if entry.name.startswith('.'):
                    continue
                
                if entry.is_dir():
                    scan_recursively(Path(entry.path))
                elif entry.is_file():
                    # Игнорируем файлы отчета, кэша и файлы в корне (если включена опция)
                    if entry.name in (cache_file_name, report_file_name) or \
                       (ignore_root_files and is_root_folder):
                        continue

                    # os.normcase для кросс-платформенной совместимости ключей
                    index[os.path.normcase(entry.name)] = Path(entry.path)
        except OSError as e:
            # Игнорируем ошибки доступа к папкам, например, из-за прав
            print(f"  ⚠️  Не удалось просканировать директорию: {current_path} ({e})")

    scan_recursively(vault_path)
    return index

def find_file_in_vault(file_index: dict[str, Path], file_name: str) -> Path | None:
    """Ищет файл в индексе, пробуя разные варианты имени."""
    path = file_index.get(os.path.normcase(file_name))
    if path:
        return path
    if not file_name.lower().endswith('.md'):
        path = file_index.get(os.path.normcase(f"{file_name}.md"))
        if path:
            return path
    return None

def _clean_markdown_body(body: str) -> str:
    """
    Удаляет блоки кода и комментарии из текста, чтобы избежать извлечения ссылок из них.
    """
    cleaned_body = re.sub(r'```.*?```', '', body, flags=re.DOTALL)
    cleaned_body = re.sub(r'%%.*?%%', '', cleaned_body, flags=re.DOTALL)
    return re.sub(r'`[^`]*`', '', cleaned_body)

def _create_obsidian_link(file_path: Path, vault: Path) -> str:
    """Создает кликабельную wikilink-ссылку для Obsidian."""
    relative_path_str = file_path.relative_to(vault).as_posix()
    if relative_path_str.lower().endswith('.md'):
        link_text = relative_path_str[:-3]
    else:
        link_text = relative_path_str
    return f"[[{link_text}]]"

def _generate_table_for_category(files: list[Path], vault: Path) -> list[str]:
    """Генерирует Markdown-таблицы для категории файлов, сгруппированных по папкам."""
    lines = []
    grouped_files = collections.defaultdict(list)
    for path in files:
        grouped_files[path.parent].append(path)

    for folder_path in sorted(grouped_files.keys(), key=str):
        folder_name = folder_path.relative_to(vault).as_posix()
        if folder_name == ".":
            folder_name = "/"
        
        lines.append(f"### 📁 `{folder_name}`\n")
        lines.append("| Файл | Расширение | Размер |\n")
        lines.append("|:---|:---|:---|\n")

        sorted_files_in_folder = sorted(
            grouped_files[folder_path], 
            key=lambda p: (p.suffix.lower(), p.name.lower())
        )

        for file in sorted_files_in_folder:
            link = _create_obsidian_link(file, vault)
            ext = file.suffix[1:].lower() if file.suffix else ""
            size_kb = f"{(file.stat().st_size / 1024):.1f} KB"
            lines.append(f"| {link} | `{ext}` | `{size_kb}` |\n")
        
        lines.append("\n")
    return lines

def analyze_file_content(content: str, file_path: Path, vault_path: Path, file_index: dict[str, Path]) -> dict:
    """Анализирует содержимое файла, извлекая все виды ссылок за один проход."""
    valid_links = set()
    broken_links = set()
    has_external_links = False
    fm_wikilinks = []
    dataview_hubs_found = []

    # --- 1. Анализ ссылок в теле и frontmatter (WIKI и INLINE) ---
    # _clean_markdown_body удаляет код-блоки и т.д., где ссылки не должны учитываться.
    cleaned_content = _clean_markdown_body(content)

    for match in WIKI_RE.finditer(cleaned_content):
        raw_link = match.group(1).strip()
        decoded_link = unquote(raw_link)
        target_path = find_file_in_vault(file_index, decoded_link)
        if target_path and target_path.exists():
            valid_links.add(target_path)
        else:
            broken_links.add(decoded_link)

    for match in INLINE_RE.finditer(cleaned_content):
        raw_link = match.group(1).strip()
        decoded_link = unquote(raw_link)
        if decoded_link.startswith(('http://', 'https://', 'ftp://', 'mailto:')):
            has_external_links = True
            continue
        current_dir = file_path.parent
        potential_path = (current_dir / decoded_link).resolve()
        if potential_path.exists() and potential_path.is_file():
            valid_links.add(potential_path)
            continue
        file_name_only = Path(decoded_link).name
        target_path = find_file_in_vault(file_index, file_name_only)
        if target_path and target_path.exists():
            valid_links.add(target_path)
        else:
            broken_links.add(decoded_link)

    # --- 2. Дополнительный анализ Frontmatter ---
    fm_match = FRONTMATTER_RE.match(content)
    if fm_match:
        frontmatter_content = fm_match.group(1)
        
        # 2.1. Анализ "виртуальных" ссылок для dataview (`wikilinks` property)
        for section in FM_WIKILINKS_SECTION_RE.finditer(frontmatter_content):
            for link_match in FM_WIKILINK_ITEM_RE.finditer(section.group(1)):
                hub_name = link_match.group(1).strip()
                fm_wikilinks.append(hub_name)
        
        # 2.2. Анализ ссылок в специальных свойствах (e.g., `banner: [[image.png]]` или `banner: image.png`)
        for prop in FRONTMATTER_LINK_PROPERTIES:
            # Regex to find `prop: value` and capture the value until the end of the line.
            prop_re = re.compile(rf'^\s*{prop}:\s*(.*)', re.MULTILINE)
            for match in prop_re.finditer(frontmatter_content):
                value_str = match.group(1).strip()
                
                # Remove potential quotes
                if (value_str.startswith('"') and value_str.endswith('"')) or \
                   (value_str.startswith("'") and value_str.endswith("'")):
                    value_str = value_str[1:-1]

                if not value_str:
                    continue

                # Now value_str is either `[[image.png]]` or `image.png`
                link_text = ""
                # Check if the value is a wikilink, e.g., "[[image.png]]"
                # Using findall to be safe, and taking the first result if multiple exist.
                wiki_links_in_value = FM_WIKILINK_ITEM_RE.findall(value_str)
                if wiki_links_in_value:
                    link_text = wiki_links_in_value[0].strip()
                else:
                    # If not a wikilink, treat the whole string as a potential path
                    link_text = value_str.strip()

                if not link_text:
                    continue
                
                decoded_link = unquote(link_text)
                
                if decoded_link.startswith(('http://', 'https://')):
                    has_external_links = True
                    continue

                # 1. Try as a path relative to the vault root.
                potential_path = (vault_path / decoded_link).resolve()
                if potential_path.exists() and potential_path.is_file():
                    valid_links.add(potential_path)
                    continue

                # 2. If not, try to find by filename in the whole vault (fallback) and handle broken links
                file_name_only = Path(decoded_link).name
                target_path = find_file_in_vault(file_index, file_name_only)
                if target_path and target_path.exists():
                    valid_links.add(target_path)
                else:
                    broken_links.add(decoded_link)

    # --- 3. Анализ dataview-запросов (может быть где угодно в файле) ---
    for block in QUERY_BLOCK_RE.finditer(content):
        for match in DATAVIEW_FILTER_RE.finditer(block.group(1)):
            hub_name = match.group(1).strip() if match.group(1) else file_path.stem
            dataview_hubs_found.append(hub_name)

    return {
        "valid_links": sorted([p.relative_to(vault_path).as_posix() for p in valid_links]),
        "broken_links": sorted(list(broken_links)),
        "has_external_links": has_external_links,
        "fm_wikilinks": fm_wikilinks,
        "dataview_hubs": dataview_hubs_found,
    }


def _load_cache(cache_path: Path) -> dict:
    """Загружает кэш из файла, если он существует и валиден."""
    if not cache_path.exists():
        return {}
    try:
        current_hash = _get_script_hash()
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        # Проверяем хэш скрипта. Если он не совпадает, считаем кэш невалидным.
        if cache_data.get("script_hash") != current_hash:
            print("  ℹ️  Логика скрипта изменилась. Будет произведен полный анализ.")
            return {}
        return cache_data.get("files", {}) # Возвращаем только словарь с файлами
    except (json.JSONDecodeError, IOError):
        print("  ⚠️  Не удалось прочитать кэш, будет произведен полный анализ.")
        return {}

def _save_cache(cache_path: Path, cache_data: dict):
    """Сохраняет данные в файл кэша."""
    full_cache_content = {
        "script_hash": _get_script_hash(),
        "files": cache_data
    }
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(full_cache_content, f, indent=2)
        print(f"✅ Кэш успешно сохранен в: {cache_path}")
    except Exception as e:
        print(f"  ⚠️  Не удалось сохранить кэш: {e}")

def _analyze_all_files(
    markdown_files: list[Path], vault_path: Path, file_index: dict, cache: dict
) -> tuple[dict[Path, dict], dict]:
    """Анализирует все markdown-файлы, используя кэш."""
    print("🔄 Анализ файлов (с использованием кэша)...")
    new_cache = {}
    all_analysis_data = {}
    files_from_cache = 0
    files_analyzed = 0

    for md_file in markdown_files:
        file_key = md_file.relative_to(vault_path).as_posix()
        current_mtime = md_file.stat().st_mtime

        if file_key in cache and cache[file_key].get("mtime") == current_mtime:
            all_analysis_data[md_file] = cache[file_key]["analysis"]
            new_cache[file_key] = cache[file_key]
            files_from_cache += 1
        else:
            try:
                content = md_file.read_text(encoding='utf-8')
                analysis_result = analyze_file_content(content, md_file, vault_path, file_index)
                all_analysis_data[md_file] = analysis_result
                new_cache[file_key] = {"mtime": current_mtime, "analysis": analysis_result}
                files_analyzed += 1
            except Exception as e:
                print(f"  ⚠️  Ошибка при анализе файла {md_file.name}: {e}")

    print(f"  - Загружено из кэша: {files_from_cache} файлов.")
    print(f"  - Проанализировано заново: {files_analyzed} файлов.")
    return all_analysis_data, new_cache

def _build_link_graph(all_files: list[Path], analysis_data: dict, vault_path: Path) -> dict:
    """Строит граф связей между файлами на основе данных анализа."""
    print("🔄 Построение графа ссылок...")
    file_graph = {
        path: {"in_links": set(), "out_links": set(), "broken_out_links": set(), "has_external_links": False}
        for path in all_files
    }

    dataview_hubs = collections.defaultdict(list)
    dataview_link_targets = collections.defaultdict(list)

    for md_file, data in analysis_data.items():
        valid_links = {vault_path / p for p in data["valid_links"]}
        file_graph[md_file]["out_links"].update(valid_links)
        file_graph[md_file]["broken_out_links"].update(data["broken_links"])
        file_graph[md_file]["has_external_links"] = data["has_external_links"]
        for target_path in valid_links:
            if target_path in file_graph:
                file_graph[target_path]["in_links"].add(md_file)

        for hub_name in data["dataview_hubs"]:
            dataview_hubs[hub_name.lower()].append(md_file)
        for hub_name in data["fm_wikilinks"]:
            dataview_link_targets[hub_name.lower()].append(md_file)

    virtual_links_count = 0
    for hub_name_lower, aggregator_files in dataview_hubs.items():
        if hub_name_lower in dataview_link_targets:
            target_files = dataview_link_targets[hub_name_lower]
            for aggregator_file in aggregator_files:
                for target_file in target_files:
                    file_graph[target_file]["in_links"].add(aggregator_file)
                    virtual_links_count += 1

    if virtual_links_count > 0:
        print(f"  - Учтено {virtual_links_count} 'виртуальных' ссылок.")
    print("✅ Граф ссылок построен.")
    return file_graph

def _categorize_files(file_graph: dict, report_file_name: str) -> dict:
    """Категоризирует файлы на основе графа ссылок."""
    print("🔄 Категоризация файлов...")
    categories = {
        "dead_ends_with_loose_ends": {},
        "dead_ends": [],
        "absolute_orphans": [],
    }

    for file_path, data in file_graph.items():
        if file_path.name == report_file_name:
            continue

        has_in_links = bool(data["in_links"])
        has_out_links = bool(data["out_links"])
        has_broken_links = bool(data["broken_out_links"])
        has_external_links = data["has_external_links"]

        if not has_in_links:
            if has_broken_links:
                categories["dead_ends_with_loose_ends"][file_path] = data["broken_out_links"]
            elif has_out_links or has_external_links:
                categories["dead_ends"].append(file_path)
            else:
                categories["absolute_orphans"].append(file_path)
    
    total_found = sum(len(v) for v in categories.values())
    print(f"✅ Найдено {total_found} проблемных файлов.")
    return categories

def _generate_report(categories: dict, vault_path: Path, report_path: Path):
    """Генерирует и сохраняет итоговый markdown-отчет."""
    total_found = sum(len(v) for v in categories.values())
    if total_found == 0:
        print("🎉 Всё связано — проблемных файлов не найдено!")
        return

    print("🔄 Создание отчета...")
    report_lines = [
        "---\n",
        "tags:\n",
        "  - optimization\n",
        "  - cleanup\n",
        "---\n\n",
        f"# Отчет о проблемных файлах ({total_found} шт.)\n\n"
    ]

    dead_ends_with_loose_ends = categories["dead_ends_with_loose_ends"]
    if dead_ends_with_loose_ends:
        report_lines.append(f"## 🕸️ Тупики с оборванными ссылками ({len(dead_ends_with_loose_ends)} шт.)\n\n")
        report_lines.append("Файлы, на которые нет ссылок, и которые сами ссылаются на **несуществующие** файлы. **Требуют внимания в первую очередь.**\n\n")
        sorted_items = sorted(dead_ends_with_loose_ends.items(), key=lambda item: str(item[0]))
        for file_path, broken_links in sorted_items:
            report_lines.append(f"- {_create_obsidian_link(file_path, vault_path)}\n")
            for broken in sorted(broken_links):
                report_lines.append(f"  - `(битая ссылка) → {broken}`\n")
        report_lines.append("\n")

    dead_ends = categories["dead_ends"]
    if dead_ends:
        report_lines.append(f"## 🛑 Тупики ({len(dead_ends)} шт.)\n\n")
        report_lines.append("Файлы, на которые нет ссылок, но которые сами ссылаются на **существующие** файлы. На эти файлы невозможно попасть по ссылкам.\n\n")
        report_lines.extend(_generate_table_for_category(dead_ends, vault_path))

    absolute_orphans = categories["absolute_orphans"]
    if absolute_orphans:
        report_lines.append(f"## 🗑️ Абсолютные сироты ({len(absolute_orphans)} шт.)\n\n")
        report_lines.append("Файлы, у которых нет ни входящих, ни исходящих ссылок.\n\n")
        report_lines.extend(_generate_table_for_category(absolute_orphans, vault_path))

    try:
        with open(report_path, 'w', encoding='utf-8') as f:
            f.writelines(report_lines)
        print(f"\n✅ Отчет успешно сохранен в: {report_path}")
    except Exception as e:
        print(f"❌ Критическая ошибка при записи файла отчета: {e}")

def main():
    """Главная функция скрипта для поиска файлов-сирот."""
    start_time = time.time()
    vault = Path(VAULT_PATH)
    if not vault.is_dir():
        print(f"❌ Ошибка: Указанный путь к хранилищу не существует или не является папкой: {VAULT_PATH}")
        return

    # Шаг 1: Индексация файлов
    print("🔄 Создание индекса файлов хранилища...")
    file_index = build_file_index(vault, IGNORED_FOLDERS, CACHE_FILE_NAME, REPORT_FILE_NAME, IGNORE_ROOT_FILES)
    all_files = list(file_index.values())
    markdown_files = [f for f in all_files if f.suffix.lower() == '.md']
    print(f"✅ Найдено {len(all_files)} файлов в хранилище ({len(markdown_files)} markdown).")

    # Шаг 2: Анализ файлов с использованием кэша
    script_dir = Path(__file__).parent.resolve()
    cache_path = script_dir / CACHE_FILE_NAME
    cache = _load_cache(cache_path)
    analysis_data, new_cache = _analyze_all_files(markdown_files, vault, file_index, cache)
    _save_cache(cache_path, new_cache)

    # Шаг 3: Построение графа ссылок
    file_graph = _build_link_graph(all_files, analysis_data, vault)

    # Шаг 4: Категоризация файлов
    categories = _categorize_files(file_graph, REPORT_FILE_NAME)

    # Шаг 5: Генерация отчета
    report_path = vault / REPORT_FILE_NAME
    _generate_report(categories, vault, report_path)
    
    end_time = time.time()
    print(f"⏱️  Время выполнения: {end_time - start_time:.2f} сек.")


if __name__ == "__main__":
    main()