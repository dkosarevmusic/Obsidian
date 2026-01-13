import os
import re
import sys

def add_deck_headers_to_file(file_path, cards_per_deck=20):
    """
    Обрабатывает markdown-файл, добавляя заголовки для новых колод
    флеш-карточек после каждого N-го изображения.

    :param file_path: Путь к файлу для обработки.
    :param cards_per_deck: Количество карточек в одной колоде.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_lines = f.readlines()

        new_lines = []
        flashcard_counter = 0
        # Начинаем нумерацию колод с 1
        deck_counter = 1
        headers_to_remove = set()
        
        # Первый проход: найдем ВСЕ существующие сгенерированные заголовки для полной перестройки
        for i, line in enumerate(original_lines):
            if re.match(r'^#flashcards/300paints/\d+$', line.strip()):
                # Также удаляем предыдущую пустую строку, если она есть
                if i > 0 and not original_lines[i-1].strip():
                    headers_to_remove.add(i-1)
                headers_to_remove.add(i)

        # Создаем чистый список строк без старых заголовков
        cleaned_lines = [line for i, line in enumerate(original_lines) if i not in headers_to_remove]

        # Второй проход: расставляем заголовки заново
        header_added = False
        for line in cleaned_lines:
            # Проверяем, является ли строка флеш-карточкой
            if line.strip().startswith('![[') and '::' in line:
                # Если это начало новой колоды, добавляем заголовок
                if flashcard_counter % cards_per_deck == 0:
                    # Добавляем пустую строку перед новым заголовком, если это не первая колода
                    if deck_counter > 1:
                        new_lines.append('\n')
                    new_lines.append(f'#flashcards/300paints/{deck_counter:02d}\n')
                    deck_counter += 1
                
                new_lines.append(line)
                flashcard_counter += 1
            else:
                # Добавляем все остальные строки (например, YAML-заголовок) как есть
                new_lines.append(line)

        final_content = "".join(new_lines)
        original_content = "".join(original_lines)

        if final_content != original_content:
            # Убираем лишние пустые строки в конце файла, если они появились
            final_content = final_content.rstrip() + '\n'
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)
            print(f"Файл '{os.path.basename(file_path)}' успешно разбит на колоды.")
        else:
            print(f"Файл '{os.path.basename(file_path)}' не требует изменений.")

    except Exception as e:
        print(f"Ошибка при обработке файла {os.path.basename(file_path)}: {e}", file=sys.stderr)


if __name__ == "__main__":
    # Определяем директорию, где лежит скрипт
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Папка с файлами для обработки находится рядом со скриптом
    working_dir = os.path.join(script_dir, "working folder")

    if not os.path.isdir(working_dir):
        print(f"Ошибка: Папка '{working_dir}' не найдена.", file=sys.stderr)
        sys.exit(1)

    print(f"Начинаю обработку файлов в папке: {working_dir}\n")
    for filename in os.listdir(working_dir):
        if filename.lower().endswith(".md"):
            file_path = os.path.join(working_dir, filename)
            add_deck_headers_to_file(file_path)

    print("\nОбработка завершена.")