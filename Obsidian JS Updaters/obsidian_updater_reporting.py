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

def generate_status_fix_report(
    results: List[AnalysisResult], 
    errors: List[AnalysisResult], 
    report_path: str, 
    vault_path: str,
    total_files_scanned: int
):
    """
    Генерирует отчет для операции исправления поля 'status'.
    """
    results.sort(key=lambda r: (r.area.lower(), r.file_path.lower()))

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 🛠️ Отчёт об исправлении поля 'status' ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})\n")
        f.write(f"🔍 Всего проанализировано: **{total_files_scanned}** файлов.\n")
        f.write(f"✅ Найдено для исправления: **{len(results)}** файлов, где `status` был списком.\n\n")
        
        if results:
            f.write("### Список измененных файлов по областям\n\n")
            for area, group in groupby(results, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    # Показываем, какое значение было до исправления
                    f.write(f"- `{relative_path}` (Было: `{res.original_status_value}`)\n")
                f.write("\n")
        
        if errors:
            f.write("\n---\n\n")
            f.write(f"### ⚠️ Обнаружены ошибки при анализе ({len(errors)}):\n")
            for err in errors:
                relative_path = os.path.relpath(err.file_path, vault_path)
                f.write(f"- ❌ Ошибка в файле `{relative_path}`: {err.error}\n")

    print(f"✅ Отчёт сохранён в '{report_path}'")

def generate_status_check_report(
    results: List[AnalysisResult],
    errors: List[AnalysisResult],
    report_path: str,
    vault_path: str,
    total_files_scanned: int
):
    """
    Генерирует отчет для операции проверки типа поля 'status'.
    """
    results.sort(key=lambda r: (r.area.lower(), r.file_path.lower()))

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 🔍 Отчёт о проверке поля 'status' ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})\n")
        f.write(f"🔍 Всего проанализировано: **{total_files_scanned}** файлов.\n")
        f.write(f"⚠️ Найдено с некорректным типом `status`: **{len(results)}** файлов.\n\n")

        if results:
            f.write("### Список файлов с 'status' не строкового типа\n\n")
            for area, group in groupby(results, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    f.write(f"- `{relative_path}` (Значение: `{res.original_status_value}`, Тип: `{type(res.original_status_value).__name__}`)\n")
                f.write("\n")

        if errors:
            f.write("\n---\n\n")
            f.write(f"### ⚠️ Обнаружены ошибки при анализе ({len(errors)}):\n")
            for err in errors:
                relative_path = os.path.relpath(err.file_path, vault_path)
                f.write(f"- ❌ Ошибка в файле `{relative_path}`: {err.error}\n")

    print(f"✅ Отчёт сохранён в '{report_path}'")

def generate_refactor_important_status_report(
    results: List[AnalysisResult],
    errors: List[AnalysisResult],
    report_path: str,
    vault_path: str,
    total_files_scanned: int
):
    """
    Генерирует отчет для операции рефакторинга статуса 'important'.
    """
    results.sort(key=lambda r: (r.area.lower(), r.file_path.lower()))

    files_with_fm_change = [r for r in results if r.status_is_important]
    files_with_str_change = [r for r in results if r.has_inline_select_string]

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"# 🔄 Отчёт о рефакторинге статуса 'important' ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})\n")
        f.write(f"🔍 Всего проанализировано: **{total_files_scanned}** файлов.\n")
        f.write(f"✅ Найдено для модификации: **{len(results)}** файлов.\n\n")

        if files_with_fm_change:
            f.write(f"### 🛠️ Метаданные (Frontmatter) изменены ({len(files_with_fm_change)} файлов)\n")
            f.write("_Статус `important` заменен на `in progress` и добавлены поля `important: true`, `urgent: true`._\n\n")
            for area, group in groupby(files_with_fm_change, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    f.write(f"- `{relative_path}`\n")
                f.write("\n")

        if files_with_str_change:
            f.write(f"### 🖋️ Строка `INPUT[inlineSelect(...)]` обновлена ({len(files_with_str_change)} файлов)\n")
            f.write("_Опция `option(important)` удалена из списка._\n\n")
            for area, group in groupby(files_with_str_change, key=lambda r: r.area):
                f.write(f"#### Area: {area}\n")
                for res in group:
                    relative_path = os.path.relpath(res.file_path, vault_path)
                    f.write(f"- `{relative_path}`\n")
                f.write("\n")

        if not files_with_fm_change and not files_with_str_change and results:
             f.write("ℹ️ Не было найдено файлов, требующих изменений в метаданных или строках inlineSelect.\n\n")
        
        if errors:
            f.write("\n---\n\n")
            f.write(f"### ⚠️ Обнаружены ошибки при анализе ({len(errors)}):\n")
            for err in errors:
                relative_path = os.path.relpath(err.file_path, vault_path)
                f.write(f"- ❌ Ошибка в файле `{relative_path}`: {err.error}\n")

    print(f"✅ Отчёт сохранён в '{report_path}'")
