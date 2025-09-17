import os
import sys
from typing import List, Optional

# PyYAML требуется для работы. Установите его: pip install PyYAML
try:
    import yaml
except ImportError:
    print("❌ Ошибка: Библиотека PyYAML не найдена. Пожалуйста, установите ее: pip install PyYAML")
    sys.exit(1)

def get_all_configs(script_dir: str, exclude: Optional[str] = None) -> List[str]:
    """Находит все .yml файлы, опционально исключая один."""
    exclude_list = [exclude] if exclude else []
    return [
        f for f in os.listdir(script_dir)
        if f.endswith(('.yml', '.yaml')) and f not in exclude_list
    ]

def select_config(config_files: List[str], script_dir: str) -> Optional[str]:
    """Предлагает пользователю выбрать конфигурационный файл из списка."""
    if not config_files:
        print("❌ Ошибка: Не найдены подходящие конфигурационные файлы (.yml/.yaml).")
        return None

    if len(config_files) == 1:
        print(f"ℹ️ Используется единственный конфигурационный файл: {config_files[0]}")
        return os.path.join(script_dir, config_files[0])

    print("Выберите конфигурационный файл:")
    for i, f in enumerate(config_files, 1):
        print(f"{i}. {f}")
    while True:
        try:
            choice = int(input(f"Введите номер (1-{len(config_files)}): "))
            if 1 <= choice <= len(config_files):
                return os.path.join(script_dir, config_files[choice - 1])
            print("Неверный номер.")
        except ValueError:
            print("Пожалуйста, введите число.")

def load_config(config_path: str) -> Optional[dict]:
    """Загружает и возвращает содержимое одного YAML-файла."""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось прочитать или разобрать файл '{config_path}': {e}")
        return None