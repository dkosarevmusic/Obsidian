import os

from obsidian_updater_core import (
    SEPARATOR_CONFIG_NAME,
    DATAVIEWJS_BLOCK_RE,
    SEPARATOR_REMOVAL_RE,
)
from obsidian_updater_config import get_all_configs, select_config, load_config
from obsidian_updater_analysis import run_analysis
from obsidian_updater_reporting import (
    generate_replace_report,
    generate_remove_report,
)
from obsidian_updater_fileops import archive_and_modify_files

def handle_replace_operation(script_dir: str):
    """Обрабатывает операцию замены блоков `dataviewjs`."""
    config_files = get_all_configs(script_dir, exclude=SEPARATOR_CONFIG_NAME)
    if not (config_path := select_config(config_files, script_dir)):
        return
    if not (config := load_config(config_path)):
        return
    
    if not (vault_path := config.get("vault_path")) or not os.path.isdir(vault_path):
        config_name = os.path.basename(config_path)
        print(f"❌ Ошибка: 'vault_path' не указан, не найден или не является папкой в '{config_name}'.")
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

def handle_remove_operation(script_dir: str):
    """Обрабатывает операцию удаления разделителей '---'."""
    config_path = os.path.join(script_dir, SEPARATOR_CONFIG_NAME)
    if not os.path.exists(config_path):
        print(f"❌ Ошибка: Конфигурационный файл для этой операции не найден: '{SEPARATOR_CONFIG_NAME}'")
        return
    
    if not (config := load_config(config_path)):
        return

    vault_path = config.get("vault_path")
    full_report_path = os.path.join(script_dir, config.get("report_file_name", "default_report.md"))
    if not vault_path or not os.path.isdir(vault_path):
        print(f"❌ Ошибка: 'vault_path' не указан или не является папкой в '{SEPARATOR_CONFIG_NAME}'")
        return

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

def main():
    """Главная функция скрипта."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Выберите основную операцию:")
    print("1. 🔄 Заменить код-блоки dataviewjs")
    print("2. 🧹 Удалить разделители '---' после код-блоков")
    
    while (choice := input("Введите 1 или 2: ")) not in ['1', '2']:
        print("Неверный ввод. Пожалуйста, введите 1 или 2.")

    if choice == '1':
        print("\n--- Операция: Замена код-блоков ---")
        handle_replace_operation(script_dir)
    elif choice == '2':
        print("\n--- Операция: Удаление разделителей ---")
        handle_remove_operation(script_dir)

if __name__ == "__main__":
    main()