import os
import re
import sys

def remove_size_from_links(file_path):
    """
    Удаляет размер из ссылок на изображения в markdown-файле.
    Обрабатывает ссылки вида ![[filename.ext|width]] и превращает их в ![[filename.ext]].
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        # Регулярное выражение для поиска ссылок с указанием размера.
        # Оно ищет ![[...|число]]
        # Группа 1: ([^|\]]+) - захватывает имя файла.
        # [0-9]+ - соответствует одному или нескольким цифровым символам (размеру).
        regex = re.compile(r'!\[\[([^|\]]+)\|[0-9]+\]\]')
        
        # Замена, оставляющая только имя файла внутри двойных скобок.
        # \1 - это ссылка на захваченную группу 1 (имя файла).
        new_content = regex.sub(r'![[\1]]', original_content)

        # Перезаписываем файл, только если были внесены изменения.
        if new_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Файл '{os.path.basename(file_path)}' обновлен. Размер из ссылок удален.")
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
            remove_size_from_links(file_path)