import os
import re
import sys

def process_markdown_file(file_path):
    """
    Обрабатывает markdown-файл: добавляет псевдонимы к ссылкам на изображения
    и удаляет пустые строки между ними.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        # Функция для замены, которая будет вызвана для каждого найденного совпадения
        def create_alias(match):
            full_link = match.group(0)
            # Проверяем, есть ли уже псевдоним
            if '::' in full_link:
                return full_link

            filename_with_ext = match.group(1)
            # Отделяем имя файла от расширения
            filename_without_ext, _ = os.path.splitext(filename_with_ext)
            
            # Формируем новую строку
            return f"![[{filename_with_ext}]]::{filename_without_ext}"

        # Используем регулярное выражение для поиска всех ссылок ![[...]]
        # Оно найдет все ссылки, а функция create_alias обработает только нужные.
        content_with_aliases = re.sub(r'!\[\[([^\]]+)\]\]', create_alias, original_content)

        # Удаляем пустые строки между ссылками на изображения
        lines = content_with_aliases.split('\n')
        processed_lines = []
        for i, line in enumerate(lines):
            # Добавляем строку, если она не пустая
            if line.strip():
                processed_lines.append(line)
            # Или если это пустая строка, но предыдущая и следующая не являются ссылками
            elif i > 0 and i < len(lines) - 1:
                prev_line = lines[i-1].strip()
                next_line = lines[i+1].strip()
                if not (prev_line.startswith('![[') and next_line.startswith('![[')):
                    processed_lines.append(line)

        final_content = '\n'.join(processed_lines)

        # Если были изменения, перезаписываем файл
        if final_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)
            print(f"Файл '{os.path.basename(file_path)}' успешно обновлен.")
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
            process_markdown_file(file_path)