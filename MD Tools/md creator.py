import os


# ================== SETTINGS ==================
# Папка (относительно скрипта), в которой будут созданы файлы.
OUTPUT_FOLDER_NAME = "working folder"

# Список элементов, для которых будут созданы .md файлы.
# Каждый элемент в списке станет отдельным файлом.
ITEMS_TO_CREATE = [
    "Бабушка",
    "Мама",
    "Александр",
    "Лейла",
    "Рома",
    "Юля",
    "Полина",
    "Олег",
    "Витя",
    "Юля Витина",
    "Кирилл",
    "Даша"
]

# Шаблон YAML frontmatter для записи в каждый новый файл.
# Используйте тройные кавычки для определения многострочного текста.
YAML_TEMPLATE = """---
Area:
  - Social
type:
  - contact
  - task
wikilinks:
  - "[[Family DB]]"
status:
  - in progress
---
"""
# ==============================================

def sanitize_filename(name: str) -> str:
    """
    Очищает строку, чтобы она стала валидным именем файла, заменяя или удаляя недопустимые символы.

    :param name: Входная строка.
    :return: Очищенная строка, подходящая для имени файла.
    """
    # Заменяем символы, которые можно осмысленно заменить
    name = name.replace("/", "-").replace(":", "-")

    # Удаляем символы, недопустимые в именах файлов Windows/macOS/Linux
    invalid_chars = '*?"<>|'
    for char in invalid_chars:
        name = name.replace(char, "")

    return name

def create_md_files(output_dir: str, items: list, template: str):
    """
    Создает .md файлы для списка элементов в указанной директории.

    :param output_dir: Абсолютный путь к выходной директории.
    :param items: Список строк, где каждая строка - это имя для нового файла.
    :param template: Содержимое (обычно YAML frontmatter), которое будет записано в каждый файл.
    """
    os.makedirs(output_dir, exist_ok=True)
    print(f"Creating files in: {output_dir}")

    for item in items:
        base_name = sanitize_filename(item)
        file_name = f"{base_name}.md"
        file_path = os.path.join(output_dir, file_name)

        try:
            with open(file_path, "w", encoding="utf-8") as file:
                file.write(template)
            print(f"  - Created: {file_name}")
        except IOError as e:
            print(f"  - Error creating {file_name}: {e}")

    print(f"\nSuccessfully created {len(items)} .md files.")

def main():
    """Основная функция для запуска скрипта."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_directory = os.path.join(script_dir, OUTPUT_FOLDER_NAME)

    create_md_files(output_directory, ITEMS_TO_CREATE, YAML_TEMPLATE)

if __name__ == "__main__":
    main()
