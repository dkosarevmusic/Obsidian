import os
import sys

# ================== НАСТРОЙКИ ==================
# Словарь с новыми свойствами для добавления в YAML-заголовки.
# Ключ - имя свойства, значение - его значение.
NEW_PROPERTIES = {
    "wikilinks": "[[Windows Software]]"
    # "new_property_2": "value_2",
    # "new_property_3": "value_3"
}
# ===============================================

# PyYAML требуется для работы. Установите его: pip install PyYAML
try:
    import yaml
except ImportError:
    print("Ошибка: Библиотека PyYAML не найдена. Пожалуйста, установите ее: pip install PyYAML", file=sys.stderr)
    sys.exit(1)
    
def process_file(file_path, new_properties):
    """Читает, обновляет YAML и перезаписывает один файл, если это необходимо."""
    filename = os.path.basename(file_path)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except IOError as e:
        print(f"Ошибка чтения файла {filename}: {e}")
        return

    if not lines or not lines[0].startswith('---'):
        print(f"В файле отсутствует YAML-заголовок: {filename}")
        return

    try:
        # Ищем закрывающий '---' начиная со второй строки
        end_yaml_idx = lines[1:].index('---\n') + 1
    except ValueError:
        print(f"Предупреждение: Не найден закрывающий тег YAML в файле: {filename}")
        return

    yaml_content = ''.join(lines[1:end_yaml_idx])
    
    try:
        # yaml.safe_load вернет None для пустого блока, `or {}` обработает этот случай
        data = yaml.safe_load(yaml_content) or {}
        if not isinstance(data, dict):
            print(f"Предупреждение: YAML в файле {filename} не является словарем. Пропускаем.")
            return
    except yaml.YAMLError as e:
        print(f"Предупреждение: Ошибка разбора YAML в файле {filename}: {e}. Пропускаем.")
        return

    # Обновляем данные, только если есть изменения, чтобы не перезаписывать файл зря
    original_data = data.copy()
    data.update(new_properties)

    if data == original_data:
        return # Изменения не требуются

    # Собираем новый файл и записываем его
    new_yaml_str = yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False)
    new_content = ['---\n', new_yaml_str, '---\n'] + lines[end_yaml_idx + 1:]

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_content)
        print(f"Файл обновлен: {filename}")
    except IOError as e:
        print(f"Ошибка записи в файл {filename}: {e}")

def main():
    """Основная функция для запуска скрипта."""
    # Создаем абсолютный путь к 'working folder' рядом со скриптом
    script_dir = os.path.dirname(os.path.abspath(__file__))
    folder_path = os.path.join(script_dir, "working folder")

    if not os.path.isdir(folder_path):
        print(f"Ошибка: Папка '{folder_path}' не найдена.", file=sys.stderr)
        sys.exit(1)

    for filename in os.listdir(folder_path):
        if filename.endswith(".md"):
            file_path = os.path.join(folder_path, filename)
            process_file(file_path, NEW_PROPERTIES)

if __name__ == "__main__":
    main()
