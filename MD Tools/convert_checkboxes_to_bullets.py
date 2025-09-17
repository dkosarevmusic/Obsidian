import os
import re

def process_markdown_file(input_path):
    """
    В файле оставляем всё как есть, заменяя лишь чекбоксы:
    - [ ] и - [x] (в любом регистре) → - 
    при этом сохраняем любые ведущие '>' и пробелы.
    """
    # Группа 1 — любые комбинации '>' и пробелов перед '- [ ]' или '- [x]'
    pattern = re.compile(r'^(\s*(?:>+\s*)*)-\s*\[[ xX]\]\s*')

    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    with open(input_path, 'w', encoding='utf-8') as f:
        for line in lines:
            # Заменяем только совпадение шаблона (checkbox → bullet),
            # всё остальное (текст, ссылки, отступы, callout) остаётся нетронутым
            new_line = pattern.sub(r'\1- ', line)
            f.write(new_line)

if __name__ == "__main__":
    # Путь к папке 'working folder' рядом со скриптом
    script_dir = os.path.dirname(os.path.abspath(__file__))
    working_dir = os.path.join(script_dir, "working folder")

    for filename in os.listdir(working_dir):
        if filename.lower().endswith(".md"):
            file_path = os.path.join(working_dir, filename)
            process_markdown_file(file_path)
            print(f"Обработан файл: {filename}")
