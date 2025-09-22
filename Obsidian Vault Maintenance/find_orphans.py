import os
import re
import collections
import json
import time
import hashlib
import sys
from pathlib import Path
from urllib.parse import unquote

# PyYAML is required for advanced frontmatter parsing (e.g., in 'banner' property).
try:
    import yaml
except ImportError:
    yaml = None # Make it optional, check for it later.

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
    ignored_folders_set = {p.strip().lower().replace("\\", "/") for p in ignored_folders}
    ignored_files_set = {cache_file_name, report_file_name}

    for root, dirs, files in os.walk(vault_path, topdown=True):
        root_path = Path(root)

        # Отсекаем игнорируемые и скрытые директории из дальнейшего обхода
        dirs[:] = [
            d for d in dirs if not d.startswith('.') and
            (root_path / d).relative_to(vault_path).as_posix().lower() not in ignored_folders_set
        ]

        # Пропускаем файлы в корневой папке, если включена опция
        if ignore_root_files and root_path == vault_path:
            continue

        for file_name in files:
            if file_name.startswith('.') or file_name in ignored_files_set:
                continue
            index[os.path.normcase(file_name)] = root_path / file_name

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

def _format_dead_ends_with_loose_ends(items: dict, vault: Path) -> list[str]:
    """Форматирует список для категории 'тупики с оборванными ссылками'."""
    lines = []
    sorted_items = sorted(items.items(), key=lambda item: str(item[0]))
    for file_path, broken_links in sorted_items:
        lines.append(f"- {_create_obsidian_link(file_path, vault)}\n")
        for broken in sorted(broken_links):
            lines.append(f"  - `(битая ссылка) → {broken}`\n")
    lines.append("\n")
    return lines

def _extract_strings_from_yaml_value(value) -> list[str]:
    """Recursively extracts all string values from a nested YAML structure (lists/dicts)."""
    strings = []
    if isinstance(value, str):
        strings.append(value)
    elif isinstance(value, list):
        for item in value:
            strings.extend(_extract_strings_from_yaml_value(item))
    elif isinstance(value, dict):
        for sub_value in value.values():
            strings.extend(_extract_strings_from_yaml_value(sub_value))
    return strings

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
        
        # 2.2. Глубокий анализ ссылок в специальных свойствах с использованием YAML-парсера
        if yaml and FRONTMATTER_LINK_PROPERTIES:
            try:
                fm_data = yaml.safe_load(frontmatter_content)
                if isinstance(fm_data, dict):
                    for prop in FRONTMATTER_LINK_PROPERTIES:
                        if prop in fm_data:
                            # Рекурсивно извлекаем все строковые значения из свойства
                            link_candidates = _extract_strings_from_yaml_value(fm_data[prop])
                            
                            for raw_link_text in link_candidates:
                                link_text = ""
                                # Сначала проверяем, не является ли строка вики-ссылкой
                                wiki_links_in_value = FM_WIKILINK_ITEM_RE.findall(raw_link_text)
                                if wiki_links_in_value:
                                    link_text = wiki_links_in_value[0].strip()
                                else:
                                    # Если нет, используем всю строку как есть
                                    link_text = raw_link_text.strip()

                                if not link_text:
                                    continue
                                
                                decoded_link = unquote(link_text)
                                
                                if decoded_link.startswith(('http://', 'https://')):
                                    has_external_links = True
                                    continue

                                # Логика поиска файла (такая же, как была)
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
            except yaml.YAMLError:
                # Игнорируем ошибки парсинга YAML, чтобы не прерывать весь анализ
                pass

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

    # Если проблемных файлов нет, создаем чистый отчет и выходим.
    if total_found == 0:
        print("🎉 Всё связано — проблемных файлов не найдено!")
        report_lines = [
            "---\ntags:\n  - optimization\n  - cleanup\n---\n\n",
            "# Отчет о проблемных файлах\n\n",
            f"✅ **Проблемных файлов не найдено.**\n\n_Отчет обновлен {time.strftime('%Y-%m-%d %H:%M:%S')}_"
        ]
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                f.writelines(report_lines)
            print(f"✅ Отчет обновлен, подтверждено отсутствие проблем: {report_path}")
        except Exception as e:
            print(f"❌ Критическая ошибка при записи файла отчета: {e}")
        return

    print("🔄 Создание отчета...")
    report_lines = [
        "---\ntags:\n  - optimization\n  - cleanup\n---\n\n",
        f"# Отчет о проблемных файлах ({total_found} шт.)\n\n"
    ]

    report_sections = {
        "dead_ends_with_loose_ends": {
            "title": "🕸️ Тупики с оборванными ссылками",
            "description": "Файлы, на которые нет ссылок, и которые сами ссылаются на **несуществующие** файлы. **Требуют внимания в первую очередь.**",
            "formatter": _format_dead_ends_with_loose_ends
        },
        "dead_ends": {
            "title": "🛑 Тупики",
            "description": "Файлы, на которые нет ссылок, но которые сами ссылаются на **существующие** файлы. На эти файлы невозможно попасть по ссылкам.",
            "formatter": _generate_table_for_category
        },
        "absolute_orphans": {
            "title": "🗑️ Абсолютные сироты",
            "description": "Файлы, у которых нет ни входящих, ни исходящих ссылок.",
            "formatter": _generate_table_for_category
        }
    }

    for key, config in report_sections.items():
        items = categories.get(key)
        if items:
            report_lines.append(f"## {config['title']} ({len(items)} шт.)\n\n")
            report_lines.append(f"{config['description']}\n\n")
            report_lines.extend(config['formatter'](items, vault_path))

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

    if not yaml:
        print("\n  ⚠️  Предупреждение: Библиотека PyYAML не найдена (команда для установки: pip install PyYAML).")
        print("     Расширенный анализ ссылок в YAML-свойствах (например, 'banner') будет пропущен.\n")

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