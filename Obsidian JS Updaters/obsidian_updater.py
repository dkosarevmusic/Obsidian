import os
import re
import yaml

from typing import Tuple
from obsidian_updater_core import (
    SEPARATOR_CONFIG_NAME,
    DATAVIEWJS_BLOCK_RE,
    SEPARATOR_REMOVAL_RE,
    FRONTMATTER_RE,
)
from obsidian_updater_config import get_all_configs, select_config, load_config
from obsidian_updater_analysis import run_analysis
from obsidian_updater_reporting import (
    generate_replace_report,
    generate_remove_report,
    generate_status_fix_report,
    generate_status_check_report,
    generate_refactor_important_status_report,
)
from obsidian_updater_fileops import archive_and_modify_files

def handle_replace_operation(script_dir: str, vault_path: str):
    """Обрабатывает операцию замены блоков `dataviewjs`."""
    config_files = get_all_configs(script_dir, exclude=SEPARATOR_CONFIG_NAME)
    if not (config_path := select_config(config_files, script_dir)):
        return
    if not (config := load_config(config_path)):
        return

    reference_file_path = config.get("reference_file_path")
    special_file_names = config.get("special_file_names", [])
    target_types = config.get("target_types", [])
    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))
    
    print("Начинаю поиск файлов в хранилище...")
    target_files, error_files = run_analysis(vault_path, special_file_names, target_types)

    files_with_blocks = [res for res in target_files if res.block_count > 0]
    print(f"Из них {len(files_with_blocks)} файлов содержат dataviewjs блоки и будут обработаны.")

    while (mode := input("\nВыберите режим выполнения:\n1. 📝 Только сгенерировать отчёт\n2. 🚀 Выполнить замену и сгенерировать отчёт\nВведите 1 или 2: ")) not in ['1', '2']:
        print("Неверный ввод. Пожалуйста, введите 1 или 2.")

    if mode == '1':
        print("\n--- Режим: Только отчёт ---")
        generate_replace_report(files_with_blocks, error_files, full_report_path, vault_path)
    
    elif mode == '2':
        print("\n--- Режим: Замена и отчёт ---")

        if not files_with_blocks:
            print("ℹ️ Нет файлов, содержащих dataviewjs блоки. Замена не требуется.")
            generate_replace_report(files_with_blocks, error_files, full_report_path, vault_path)
            return
        
        reference_content = ""
        try:
            with open(reference_file_path, 'r', encoding='utf-8') as f:
                reference_file_content = f.read()
            match = DATAVIEWJS_BLOCK_RE.search(reference_file_content)
            if not match:
                print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: В файле-шаблоне '{reference_file_path}' не найден блок ```dataviewjs...``` для замены.")
                return
            
            reference_content = match.group(0)
            print(f"✅ Файл-шаблон '{reference_file_path}' успешно прочитан. Используется только блок dataviewjs.")
        except (FileNotFoundError, TypeError) as e:
            print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось прочитать файл-шаблон '{reference_file_path}'. Убедитесь, что 'reference_file_path' указан в конфиге и файл существует. Ошибка: {e}")
            return
        print(f"\n⚠️ ВНИМАНИЕ: Будет предпринята попытка изменить {len(files_with_blocks)} файлов.")
        confirm = input("Вы уверены, что хотите продолжить? (введите 'yes'): ").lower()
        if confirm != 'yes':
            print("🚫 Замена отменена пользователем.")
            return

        modification_func = lambda content: DATAVIEWJS_BLOCK_RE.subn(reference_content, content)
        archive_and_modify_files(files_with_blocks, vault_path, modification_func)
        generate_replace_report(files_with_blocks, error_files, full_report_path, vault_path)

def handle_remove_operation(script_dir: str, vault_path: str):
    """Обрабатывает операцию удаления разделителей '---'."""
    config_path = os.path.join(script_dir, SEPARATOR_CONFIG_NAME)
    if not os.path.exists(config_path):
        print(f"❌ Ошибка: Конфигурационный файл для этой операции не найден: '{SEPARATOR_CONFIG_NAME}'")
        return
    
    if not (config := load_config(config_path)):
        return

    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))

    # Собираем все target_types из всех остальных конфигов
    other_configs = get_all_configs(script_dir, exclude=SEPARATOR_CONFIG_NAME)

    # Исключаем конфиги, указанные в 'exclude_configs'
    configs_to_exclude = config.get("exclude_configs", [])
    other_configs = [c for c in other_configs if c not in configs_to_exclude]

    if other_configs:
        print(f"ℹ️ Для определения целевых файлов будут просканированы 'target_types' из других конфигов: {', '.join(other_configs)}")

    aggregated_types = set()
    for cfg_path_str in other_configs:
        full_cfg_path = os.path.join(script_dir, cfg_path_str)
        if other_cfg := load_config(full_cfg_path):
            aggregated_types.update(other_cfg.get("target_types", []))
    
    if not aggregated_types:
        print("⚠️ Предупреждение: Не найдено ни одного 'target_types' в других конфигурационных файлах. Будут обработаны только файлы, где `type` не указан.")

    target_files, error_files = run_analysis(vault_path, special_names=[], target_types=list(aggregated_types))

    files_to_clean = [res for res in target_files if res.separators_found_count > 0]
    print(f"Из них {len(files_to_clean)} файлов содержат разделители '---' после блоков и будут обработаны.")

    while (mode := input("\nВыберите режим выполнения:\n1. 📝 Только сгенерировать отчёт\n2. 🚀 Выполнить удаление и сгенерировать отчёт\nВведите 1 или 2: ")) not in ['1', '2']:
        print("Неверный ввод. Пожалуйста, введите 1 или 2.")

    if mode == '1':
        print("\n--- Режим: Только отчёт ---")
        generate_remove_report(files_to_clean, error_files, full_report_path, vault_path)
    
    elif mode == '2':
        print("\n--- Режим: Удаление и отчёт ---")
        if not files_to_clean:
            print("ℹ️ Нет файлов, требующих очистки.")
            generate_remove_report(files_to_clean, error_files, full_report_path, vault_path)
            return

        print(f"\n⚠️ ВНИМАНИЕ: Будет предпринята попытка изменить {len(files_to_clean)} файлов.")
        confirm = input("Вы уверены, что хотите продолжить? (введите 'yes'): ").lower()
        if confirm != 'yes':
            print("🚫 Операция отменена пользователем.")
            return

        # Заменяем найденный блок (включая разделитель) на сам код-блок + два переноса строки.
        # Это гарантирует, что после блока dataviewjs останется пустая строка,
        # и он не "слипнется" со следующим элементом в файле.
        modification_func = lambda content: SEPARATOR_REMOVAL_RE.subn(r"\1\n\n", content)
        archive_and_modify_files(files_to_clean, vault_path, modification_func)
        generate_remove_report(files_to_clean, error_files, full_report_path, vault_path)

def handle_status_fix_operation(script_dir: str, vault_path: str):
    """Обрабатывает операцию исправления поля 'status' из списка в строку."""
    # Используем конфиг от операции №2 для консистентности имени файла отчета
    config_path = os.path.join(script_dir, SEPARATOR_CONFIG_NAME)
    if not os.path.exists(config_path):
        print(f"❌ Ошибка: Конфигурационный файл '{SEPARATOR_CONFIG_NAME}' не найден. Он нужен для определения имени файла отчета.")
        return

    if not (config := load_config(config_path)):
        return

    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))

    print("Начинаю анализ файлов на наличие поля 'status' в виде списка...")
    # Анализируем ВСЕ файлы, используя новый флаг return_all_files=True
    target_files, error_files = run_analysis(vault_path, special_names=[], target_types=None, return_all_files=True)

    print(f"Всего проанализировано: {len(target_files)} файлов.")
    files_to_fix = [res for res in target_files if res.status_is_list]
    print(f"Найдено {len(files_to_fix)} файлов для исправления.")

    while (mode := input("\nВыберите режим выполнения:\n1. 📝 Только сгенерировать отчёт\n2. 🚀 Выполнить исправление и сгенерировать отчёт\nВведите 1 или 2: ")) not in ['1', '2']:
        print("Неверный ввод. Пожалуйста, введите 1 или 2.")

    # Передаем общее количество проанализированных файлов в функцию генерации отчета
    if mode == '1':
        print("\n--- Режим: Только отчёт ---")
        generate_status_fix_report(files_to_fix, error_files, full_report_path, vault_path, total_files_scanned=len(target_files))

    elif mode == '2':
        print("\n--- Режим: Исправление и отчёт ---")
        if not files_to_fix:
            print("ℹ️ Нет файлов, требующих исправления.")
            generate_status_fix_report(files_to_fix, error_files, full_report_path, vault_path, total_files_scanned=len(target_files))
            return

        print(f"\n⚠️ ВНИМАНИЕ: Будет предпринята попытка изменить {len(files_to_fix)} файлов.")
        confirm = input("Вы уверены, что хотите продолжить? (введите 'yes'): ").lower()
        if confirm != 'yes':
            print("🚫 Операция отменена пользователем.")
            return

        def fix_status_field(content: str) -> Tuple[str, int]:
            fm_match = FRONTMATTER_RE.match(content)
            if not fm_match:
                return content, 0

            fm_text = fm_match.group(1)
            try:
                frontmatter = yaml.safe_load(fm_text)
                if isinstance(frontmatter, dict) and isinstance(frontmatter.get('status'), list):
                    status_list = frontmatter['status']
                    # Берем первый элемент или оставляем пустым, если список пуст
                    frontmatter['status'] = status_list[0] if status_list else ''
                    
                    # Преобразуем обратно в YAML, сохраняя порядок и стиль
                    new_fm_text = yaml.dump(frontmatter, sort_keys=False, allow_unicode=True, default_flow_style=False)
                    new_content = content.replace(fm_text, new_fm_text, 1)
                    return new_content, 1
            except yaml.YAMLError:
                return content, 0 # Не трогаем файлы с ошибками YAML
            return content, 0

        archive_and_modify_files(files_to_fix, vault_path, fix_status_field)
        generate_status_fix_report(files_to_fix, error_files, full_report_path, vault_path, total_files_scanned=len(target_files))

def handle_status_check_operation(script_dir: str, vault_path: str):
    """Проверяет, что поле 'status' является строкой, и генерирует отчет."""
    # Используем конфиг от операции №2 для консистентности имени файла отчета
    config_path = os.path.join(script_dir, SEPARATOR_CONFIG_NAME)
    if not os.path.exists(config_path):
        print(f"❌ Ошибка: Конфигурационный файл '{SEPARATOR_CONFIG_NAME}' не найден. Он нужен для определения имени файла отчета.")
        return

    if not (config := load_config(config_path)):
        return

    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))

    print("Начинаю анализ файлов на тип поля 'status'...")
    # Анализируем ВСЕ файлы
    all_files, error_files = run_analysis(vault_path, special_names=[], target_types=None, return_all_files=True)

    files_with_invalid_status = [res for res in all_files if res.status_is_not_string]
    print(f"Всего проанализировано: {len(all_files)} файлов.")
    print(f"Найдено {len(files_with_invalid_status)} файлов, где 'status' не является строкой.")

    generate_status_check_report(files_with_invalid_status, error_files, full_report_path, vault_path, total_files_scanned=len(all_files))


def handle_refactor_important_status_operation(script_dir: str, vault_path: str):
    """Обрабатывает операцию рефакторинга статуса 'important'."""
    config_path = os.path.join(script_dir, SEPARATOR_CONFIG_NAME)
    if not os.path.exists(config_path):
        print(f"❌ Ошибка: Конфигурационный файл '{SEPARATOR_CONFIG_NAME}' не найден. Он нужен для определения имени файла отчета.")
        return

    if not (config := load_config(config_path)):
        return

    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))

    print("Начинаю анализ файлов для рефакторинга статуса 'important'...")
    all_files, error_files = run_analysis(vault_path, special_names=[], target_types=None, return_all_files=True)

    files_to_modify = [res for res in all_files if res.status_is_important or res.has_inline_select_string]
    
    print(f"Всего проанализировано: {len(all_files)} файлов.")
    print(f"Найдено {len(files_to_modify)} файлов для модификации.")

    while (mode := input("\nВыберите режим выполнения:\n1. 📝 Только сгенерировать отчёт\n2. 🚀 Выполнить рефакторинг и сгенерировать отчёт\nВведите 1 или 2: ")) not in ['1', '2']:
        print("Неверный ввод. Пожалуйста, введите 1 или 2.")

    if mode == '1':
        print("\n--- Режим: Только отчёт ---")
        generate_refactor_important_status_report(files_to_modify, error_files, full_report_path, vault_path, total_files_scanned=len(all_files))

    elif mode == '2':
        print("\n--- Режим: Рефакторинг и отчёт ---")
        if not files_to_modify:
            print("ℹ️ Нет файлов, требующих рефакторинга.")
            generate_refactor_important_status_report([], error_files, full_report_path, vault_path, total_files_scanned=len(all_files))
            return

        print(f"\n⚠️ ВНИМАНИЕ: Будет предпринята попытка изменить {len(files_to_modify)} файлов.")
        confirm = input("Вы уверены, что хотите продолжить? (введите 'yes'): ").lower()
        if confirm != 'yes':
            print("🚫 Операция отменена пользователем.")
            return

        def refactor_important_status(content: str) -> Tuple[str, int]:
            made_change = False

            # Шаг 1: Обновление Frontmatter
            fm_match = FRONTMATTER_RE.match(content)
            if fm_match:
                fm_text = fm_match.group(1)
                try:
                    frontmatter = yaml.safe_load(fm_text)
                    if isinstance(frontmatter, dict) and frontmatter.get('status') == 'important':
                        frontmatter['status'] = 'in progress'
                        frontmatter['important'] = True
                        frontmatter['urgent'] = True
                        
                        new_fm_text = yaml.dump(frontmatter, sort_keys=False, allow_unicode=True, default_flow_style=False)
                        new_content_fm = content.replace(fm_text, new_fm_text, 1)
                        if new_content_fm != content:
                            content = new_content_fm
                            made_change = True
                except yaml.YAMLError:
                    pass  # Игнорируем ошибки YAML, чтобы не повредить файл

            # Шаг 2: Обновление строки inlineSelect (исправленная логика)
            original_content_for_re = content
            # Сначала удаляем ", option(important)"
            content, num_subs1 = re.subn(r', *option\(important\)', '', content)
            # Затем удаляем "option(important), "
            content, num_subs2 = re.subn(r'option\(important\), *', '', content)
            
            if num_subs1 > 0 or num_subs2 > 0:
                made_change = True
            
            return content, 1 if made_change else 0

        archive_and_modify_files(files_to_modify, vault_path, refactor_important_status)
        generate_refactor_important_status_report(files_to_modify, error_files, full_report_path, vault_path, total_files_scanned=len(all_files))


def main():
    """Главная функция скрипта."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    VAULT_CONFIG_NAME = "vault_config.yml"
    vault_config_path = os.path.join(script_dir, VAULT_CONFIG_NAME)

    if not os.path.exists(vault_config_path):
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Глобальный конфигурационный файл '{VAULT_CONFIG_NAME}' не найден.")
        print("Пожалуйста, создайте его и укажите 'vault_path'.")
        return

    vault_config = load_config(vault_config_path)
    if not vault_config or not (vault_path := vault_config.get("vault_path")):
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Ключ 'vault_path' не найден в '{VAULT_CONFIG_NAME}'.")
        return

    # Нормализуем слэши в пути для кросс-платформенной совместимости
    vault_path = vault_path.replace('\\', '/')

    if not os.path.isdir(vault_path):
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Путь '{vault_path}', указанный в '{VAULT_CONFIG_NAME}', не существует или не является папкой.")
        return
    
    print(f"✅ Работаем с хранилищем: {vault_path}\n")
    
    print("Выберите основную операцию:")
    print("1. 🔄 Заменить код-блоки dataviewjs")
    print("2. 🧹 Удалить разделители '---' после код-блоков")
    print("3. 🛠️  Исправить поле 'status' (из списка в строку)")
    print("4. 🔍 Проверить тип поля 'status' (должен быть строкой)")
    print("5. 🏭 Рефакторинг статуса 'important'")
    
    while (choice := input("Введите 1, 2, 3, 4 или 5: ")) not in ['1', '2', '3', '4', '5']:
        print("Неверный ввод. Пожалуйста, введите 1, 2, 3, 4 или 5.")

    if choice == '1':
        print("\n--- Операция: Замена код-блоков ---")
        handle_replace_operation(script_dir, vault_path)
    elif choice == '2':
        print("\n--- Операция: Удаление разделителей ---")
        handle_remove_operation(script_dir, vault_path)
    elif choice == '3':
        print("\n--- Операция: Исправление поля 'status' ---")
        handle_status_fix_operation(script_dir, vault_path)
    elif choice == '4':
        print("\n--- Операция: Проверка типа поля 'status' ---")
        handle_status_check_operation(script_dir, vault_path)
    elif choice == '5':
        print("\n--- Операция: Рефакторинг статуса 'important' ---")
        handle_refactor_important_status_operation(script_dir, vault_path)

if __name__ == "__main__":
    main()