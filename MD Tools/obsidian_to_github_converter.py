import os
import re

def generate_github_anchor(text):
    """
    Генерирует GitHub-совместимый якорь (anchor) из текста заголовка.
    Удаляет эмодзи, приводит к нижнему регистру, заменяет пробелы дефисами
    и удаляет прочие спецсимволы.
    """
    # Регулярное выражение для удаления большинства эмодзи и некоторых символов
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002700-\U000027BF"  # dingbats
        "\U0001f900-\U0001f9ff"  # supplemental symbols and pictographs
        "\u2600-\u26FF"          # miscellaneous symbols
        "\u200d"                 # zero-width joiner
        "]+",
        flags=re.UNICODE,
    )
    text = emoji_pattern.sub('', text)
    
    # Приводим к нижнему регистру
    anchor = text.lower()
    # Заменяем пробелы и группы пробелов на один дефис
    anchor = re.sub(r'\s+', '-', anchor)
    # Удаляем все символы, кроме букв (включая кириллицу), цифр и дефисов
    anchor = re.sub(r'[^\w\dа-яё-]', '', anchor, flags=re.UNICODE)
    # Заменяем множественные дефисы на один
    anchor = re.sub(r'-+', '-', anchor)
    # Удаляем дефисы в начале и конце строки
    anchor = anchor.strip('-')
    return anchor

def convert_obsidian_to_github_md(input_content):
    """
    Преобразует Obsidian-специфичные элементы Markdown в GitHub-совместимый формат.
    """
    lines = input_content.split('\n')
    
    # --- Проход 1: Преобразование ссылок, callouts и чек-боксов ---
    
    processed_lines = []
    in_navigation_block = False
    
    # Паттерн для чек-боксов из convert_checkboxes_to_bullets.py
    checkbox_pattern = re.compile(r'^(\s*(?:>+\s*)*)-\s*\[[ xX]\]\s*')

    i = 0
    while i < len(lines):
        line = lines[i]

        # 4. Конвертируем чек-боксы в списки на каждой строке
        line = checkbox_pattern.sub(r'\1- ', line)

        # 1. Найти и полностью удалить блок навигации
        if re.match(r'^\s*>\s*\[!Navigation\]', line, flags=re.IGNORECASE):
            in_navigation_block = True
        
        if in_navigation_block:
            # Если мы в блоке навигации, проверяем, не закончился ли он
            if not line.strip().startswith('>'):
                in_navigation_block = False
                # Эта строка уже не относится к блоку, поэтому она будет обработана дальше
            else:
                # Если строка все еще часть блока навигации, пропускаем ее
                i += 1
                continue

        # 3. Обработка Callouts: преобразование в стандартные заголовки
        callout_match = re.match(r'^\s*((?:> ?)+)\s*\[!(info|example)\]\s*(.*)', line, flags=re.IGNORECASE)
        if callout_match:
            quote_level_str = callout_match.group(1)
            callout_type = callout_match.group(2).lower()
            title = callout_match.group(3).strip()

            if callout_type == 'info':
                header_prefix = '#' * (quote_level_str.count('>') + 2)
            else: # example
                header_prefix = '####'

            if title:
                processed_lines.append(f"{header_prefix} {title}")

            i += 1
            # Обрабатываем все последующие строки, которые являются частью этого callout-блока
            while i < len(lines):
                current_callout_line = lines[i]
                if current_callout_line.strip().startswith('>'):
                    cleaned_line = re.sub(r'^(> ?)+', '', current_callout_line)
                    if re.match(r'^\s*\[!(info|example)\]', cleaned_line, flags=re.IGNORECASE):
                        break
                    cleaned_line = checkbox_pattern.sub(r'\1- ', cleaned_line)
                    processed_lines.append(cleaned_line)
                    i += 1
                else:
                    break
            processed_lines.append("")
            continue

        processed_lines.append(line)
        i += 1
    
    # --- Проход 2: Создание иерархических сворачиваемых секций для H1/H2 ---
    final_lines = []
    # 0: нет открытых, 1: открыт H1, 2: открыт H2
    details_level = 0
    h3_plus_stack = [] # Стек для отслеживания уровней H3+ внутри H2

    for i, line in enumerate(processed_lines):
        # Ищем заголовки всех уровней
        h1_match = re.match(r'^#\s+(.+)', line)
        h2_match = re.match(r'^##\s+(.+)', line)
        h3_plus_match = re.match(r'^(#{3,})\s+(.*)', line)

        # Обработка горизонтальной черты как конца всех блоков
        if line.strip() == '---':
            if details_level == 2:
                final_lines.append("> </details>")
                final_lines.append("")
            if details_level >= 1:
                final_lines.append("</details>")
                final_lines.append("")
            details_level = 0
            h3_plus_stack = []
            final_lines.append(line)
            continue

        if h1_match:
            if details_level == 2:
                final_lines.append("> </details>")
                final_lines.append("")
            if details_level >= 1:
                final_lines.append("</details>")
                final_lines.append("")
            h3_plus_stack = []
            
            # Выводим заголовок как есть
            final_lines.append(line)
            final_lines.append("")
            # А под ним создаем сворачиваемый блок
            final_lines.append("<details>")
            final_lines.append("<summary>...</summary>")
            final_lines.append("")
            details_level = 1
            continue
        
        if h2_match:
            if details_level == 2:
                final_lines.append("> </details>")
                final_lines.append("")
            h3_plus_stack = []
            summary_text = h2_match.group(1).strip()
            if "table of contents" in summary_text.lower():
                final_lines.append(line)
                details_level = 1 # Считаем, что вышли из вложенного блока
            else:
                # Выводим заголовок с отступом
                final_lines.append(f"> {line}")
                final_lines.append(">")
                # А под ним создаем сворачиваемый блок
                final_lines.append("> <details>")
                final_lines.append("> <summary>...</summary>")
                final_lines.append(">")
                details_level = 2
            continue

        # Логика для H3+ и контента внутри H2
        if details_level == 2:
            if h3_plus_match:
                new_level = len(h3_plus_match.group(1))
                # Закрываем все вложенные блоки, которые на том же или более глубоком уровне
                while h3_plus_stack and h3_plus_stack[-1] >= new_level:
                    level_to_close = h3_plus_stack[-1]
                    h3_plus_stack.pop()
                    # Если мы закрываем блок, чтобы открыть новый того же или более высокого уровня,
                    # добавляем пустую строку-разделитель.
                    if level_to_close >= new_level:
                        break_prefix_count = 1 + (new_level - 3)
                        final_lines.append("> " * max(0, break_prefix_count))

                h3_plus_stack.append(new_level)
                prefix = "> " * (1 + (new_level - 2))
                final_lines.append(f"{prefix.rstrip()}{line}")
            else: # Обычный контент или пустая строка внутри H2
                current_h3_level = h3_plus_stack[-1] if h3_plus_stack else 0
                h3_nesting = (current_h3_level - 2) if current_h3_level > 0 else 0
                content_prefix = "> " * (1 + h3_nesting)

                if not line.strip(): # Если строка пустая
                    next_non_blank_line = ""
                    for j in range(i + 1, len(processed_lines)):
                        if processed_lines[j].strip():
                            next_non_blank_line = processed_lines[j]
                            break
                    
                    next_header_match = re.match(r'^(#{3,})\s+', next_non_blank_line)
                    if next_header_match and current_h3_level > 0:
                        next_level = len(next_header_match.group(1))
                        if next_level <= current_h3_level:
                            # Это пустая строка-разделитель. Вычисляем отступ на основе уровня СЛЕДУЮЩЕГО заголовка.
                            break_prefix_count = 1 + (next_level - 3)
                            final_lines.append("> " * max(0, break_prefix_count))
                        else:
                            final_lines.append(content_prefix.rstrip())
                    else:
                        # Это обычная пустая строка внутри контента, сохраняем полный отступ.
                        final_lines.append(content_prefix.rstrip())
                else:
                    final_lines.append(f"{content_prefix.rstrip()}{line}")
        else: # Контент вне H2 (внутри H1 или глобальный)
            final_lines.append(line)
            continue

    # Закрываем все оставшиеся открытые теги в конце файла
    if details_level == 2:
        final_lines.append("> </details>")
        final_lines.append("")
    if details_level >= 1:
        final_lines.append("</details>")
        final_lines.append("")

    return "\n".join(final_lines)

def main():
    """
    Основная функция для запуска скрипта.
    Находит все .md файлы в 'working folder', конвертирует их и перезаписывает.
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        working_dir = os.path.join(script_dir, "working folder")

        if not os.path.isdir(working_dir):
            print(f"Ошибка: Папка 'working folder' не найдена по пути: {working_dir}")
            return

        print(f"Поиск файлов в: {working_dir}")
        found_files = False
        for filename in os.listdir(working_dir):
            if filename.lower().endswith(".md"):
                found_files = True
                file_path = os.path.join(working_dir, filename)
                
                print(f"Обработка файла: {filename}...")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Проверяем, не пустой ли файл
                    if not content.strip():
                        print(f"  - Файл '{filename}' пуст, пропуск.")
                        continue

                    converted_content = convert_obsidian_to_github_md(content)

                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(converted_content)
                    print(f"  - Файл '{filename}' был успешно преобразован.")
                
                except Exception as e:
                    print(f"  - Ошибка при обработке файла '{filename}': {e}")

        if not found_files:
            print("Markdown-файлы для обработки не найдены.")

    except Exception as e:
        print(f"Произошла критическая ошибка: {e}")

if __name__ == "__main__":
    main()