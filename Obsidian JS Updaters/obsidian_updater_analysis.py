import os
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import List, Tuple

# PyYAML требуется для работы. Установите его: pip install PyYAML
try:
    import yaml
except ImportError:
    print("❌ Ошибка: Библиотека PyYAML не найдена. Пожалуйста, установите ее: pip install PyYAML")
    sys.exit(1)

from obsidian_updater_core import (
    AnalysisResult,
    FRONTMATTER_RE,
    DATAVIEWJS_BLOCK_RE,
    format_yaml_value
)

def analyze_file(file_path: str, special_names: List[str], target_types: List[str]) -> AnalysisResult:
    """Анализирует один markdown-файл, извлекая метаданные и считая dataviewjs блоки."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        is_special_name = os.path.basename(file_path) in special_names
        area, file_type_str = "[No Area]", "[No Type]"
        has_target_type, has_non_target_type = False, False

        if fm_match := FRONTMATTER_RE.match(content):
            try:
                if (frontmatter := yaml.safe_load(fm_match.group(1))) and isinstance(frontmatter, dict):
                    area = format_yaml_value(frontmatter.get('Area'), '[No Area]')
                    
                    if file_type := frontmatter.get('type'):
                        file_type_str = format_yaml_value(file_type, '[No Type]')
                        types_to_check = {str(s) for s in (file_type if isinstance(file_type, list) else [file_type]) if s}
                        if types_to_check:
                            target_types_set = set(target_types)
                            has_target_type = not types_to_check.isdisjoint(target_types_set)
                            has_non_target_type = bool(types_to_check - target_types_set)
            except yaml.YAMLError as e:
                return AnalysisResult(file_path, is_target=False, error=f"Ошибка YAML: {e}")

        is_target = is_special_name or has_target_type

        block_count = 0
        separators_found_count = 0
        for match in DATAVIEWJS_BLOCK_RE.finditer(content):
            block_count += 1
            if match.group(2):  # Если группа с разделителем найдена
                separators_found_count += 1
        
        return AnalysisResult(
            file_path, is_target=is_target, area=area, file_type=file_type_str,
            has_target_type=has_target_type, has_non_target_type=has_non_target_type,
            block_count=block_count,
            separators_found_count=separators_found_count
        )

    except Exception as e:
        return AnalysisResult(file_path, is_target=False, error=f"{type(e).__name__}: {e}")

def run_analysis(vault_path: str, special_names: List[str], target_types: List[str]) -> Tuple[List[AnalysisResult], List[AnalysisResult]]:
    """Сканирует хранилище и анализирует файлы в несколько потоков."""
    print("\nНачинаю анализ файлов в хранилище...")
    all_md_files = [os.path.join(root, file) for root, _, files in os.walk(vault_path) for file in files if file.lower().endswith('.md')]
    
    results = []
    with ProcessPoolExecutor() as executor:
        futures = [executor.submit(analyze_file, path, special_names, target_types) for path in all_md_files]
        results.extend(future.result() for future in as_completed(futures))

    error_files = [r for r in results if r.error]
    all_target_files = [r for r in results if r.is_target and not r.error]
    print(f"Анализ завершен. Найдено {len(all_target_files)} целевых файлов.")
    return all_target_files, error_files