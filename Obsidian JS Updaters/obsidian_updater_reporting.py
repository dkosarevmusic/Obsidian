import os
from datetime import datetime
from itertools import groupby
from typing import List

from obsidian_updater_core import AnalysisResult

def generate_replace_report(results: List[AnalysisResult], errors: List[AnalysisResult], report_path: str, vault_path: str):
    """
    Генерирует отчет для операции ЗАМЕНЫ блоков.
    """
    results.sort(key=lambda r: (r.area.lower(), r.file_path.lower()))

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 📜 Отчёт о файлах для обновления ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})\n\n")
        
        files_to_check = sum(1 for r in results if not r.has_target_type or r.has_non_target_type)
        files_ok = len(results) - files_to_check

        f.write(f"🔍 Найдено для обработки: **{len(results)}** файлов.\n")
        f.write(f"- ✅ С корректным типом: **{files_ok}**\n")
        f.write(f"- ✍️ Требуют проверки типа: **{files_to_check}**\n\n")
        
        if results:
            f.write("### Список файлов по областям\n\n")
            f.write("✍️ - *файл будет обработан, но требует проверки. Возможные причины: `type` отсутствует, не соответствует `target_types` или содержит смесь целевых и нецелевых типов.*\n\n")
            for area, group in groupby(results, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    emoji = "✍️" if not res.has_target_type or res.has_non_target_type else "📄"
                    f.write(f"- {emoji} `{relative_path}` (Type: **{res.file_type}**, Блоков: {res.block_count})\n")
                f.write("\n")
        
        if errors:
            f.write("\n---\n\n")
            f.write(f"### ⚠️ Обнаружены ошибки ({len(errors)}):\n")
            for err in errors:
                relative_path = os.path.relpath(err.file_path, vault_path)
                f.write(f"- ❌ Ошибка в файле `{relative_path}`: {err.error}\n")
    
    print(f"✅ Отчёт сохранён в '{report_path}'")

def generate_remove_report(results: List[AnalysisResult], errors: List[AnalysisResult], report_path: str, vault_path: str):
    """
    Генерирует отчет для операции УДАЛЕНИЯ разделителей.
    """
    results.sort(key=lambda r: (r.area.lower(), r.file_path.lower()))

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 🧹 Отчёт об удалении разделителей ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})\n\n")
        f.write(f"🔍 Найдено для обработки: **{len(results)}** файлов, где `dataviewjs` блок соседствует с `---`.\n\n")
        
        if results:
            f.write("### Список файлов по областям\n\n")
            for area, group in groupby(results, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    f.write(f"- `{relative_path}` (Найдено разделителей: {res.separators_found_count})\n")
                f.write("\n")
        
        if errors:
            f.write("\n---\n\n")
            f.write(f"### ⚠️ Обнаружены ошибки ({len(errors)}):\n")
            for err in errors:
                relative_path = os.path.relpath(err.file_path, vault_path)
                f.write(f"- ❌ Ошибка в файле `{relative_path}`: {err.error}\n")
    
    print(f"✅ Отчёт сохранён в '{report_path}'")