import os
import re
import sys

# --- НАСТРОЙКИ ---
# Укажите желаемую ширину для изображений.
IMAGE_WIDTH = 1000
# -----------------

def add_size_to_links(file_path, width):
    """
    Добавляет размер к ссылкам на изображения в markdown-файле.
    Обрабатывает ссылки вида ![[filename.ext]] и превращает их в ![[filename.ext|width]].
    Игнорирует ссылки, у которых уже указан размер (содержат символ '|').
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        # Регулярное выражение для поиска ссылок без указания размера.
        # Оно ищет ![[...]], где внутри нет символа '|'.
        # Группа 1: (.*?) - захватывает имя файла.
        regex = re.compile(r'!\[\[([^|\]]+)\]\]')
        
        # Замена с использованием f-строки для подстановки ширины.
        # \1 - это ссылка на захваченную группу 1 (имя файла).
        new_content = regex.sub(rf'![[\1|{width}]]', original_content)

        # Перезаписываем файл, только если были внесены изменения.
        if new_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Файл '{os.path.basename(file_path)}' обновлен. Добавлен размер: {width}.")
        else:
            print(f"Файл '{os.path.basename(file_path)}' не требует изменений.")

    except Exception as e:
        print(f"Ошибка при обработке файла {os.path.basename(file_path)}: {e}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    working_dir = os.path.join(script_dir, "working folder")

    if not os.path.isdir(working_dir):
        print(f"Ошибка: Папка '{working_dir}' не найдена.")
        sys.exit(1)

    print(f"Начинаю обработку файлов в папке: {working_dir}\n")
    for filename in os.listdir(working_dir):
        if filename.lower().endswith(".md"):
            file_path = os.path.join(working_dir, filename)
            add_size_to_links(file_path, IMAGE_WIDTH)

