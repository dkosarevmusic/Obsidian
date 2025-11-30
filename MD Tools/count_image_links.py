import sys
import os
import re

def count_links_in_file(file_path):
    """
    Подсчитывает количество ссылок на изображения в формате ![[...]] в файле.

    Аргументы:
        file_path (str): Путь к файлу для анализа.
    """
    # Проверяем, существует ли файл
    if not os.path.exists(file_path):
        print(f"Ошибка: Файл не найден по пути: {file_path}")
        return

    try:
        # Читаем содержимое файла с кодировкой utf-8
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Используем регулярное выражение для поиска всех ссылок на изображения
        image_link_regex = r'!\[\[.*?\]\]'
        matches = re.findall(image_link_regex, content)

        # Считаем количество найденных ссылок
        count = len(matches)

        print(f"Файл: {os.path.basename(file_path)}")
        print(f"  - Найдено ссылок на изображения: {count}")

    except Exception as e:
        print(f"Произошла ошибка при чтении или обработке файла: {e}")

if __name__ == "__main__":
    # Папка, в которой находятся файлы для обработки.
    WORKING_FOLDER_NAME = "working folder"

    # Определяем путь к папке 'working folder' относительно скрипта
    script_dir = os.path.dirname(os.path.abspath(__file__))
    working_dir = os.path.join(script_dir, WORKING_FOLDER_NAME)

    if not os.path.isdir(working_dir):
        print(f"Ошибка: Папка '{working_dir}' не найдена.")
        sys.exit(1)

    print(f"Начинаю анализ файлов в папке: {working_dir}\n")

    # Проходим по всем файлам в директории
    for filename in os.listdir(working_dir):
        # Обрабатываем только файлы с расширением .md
        if filename.lower().endswith(".md"):
            file_path = os.path.join(working_dir, filename)
            count_links_in_file(file_path)