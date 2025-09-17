import os
import sys

# ================== НАСТРОЙКИ ==================
# Папка (относительно скрипта), в которой находятся файлы для обработки.
FOLDER_NAME = "working folder"

# Словарь для замены: "что найти": "на что заменить".
# Замена чувствительна к регистру.
FIND_REPLACE_MAP = {
    "Company": "Brand",
    "Type": "tags",
    "Фишка": "Comment",
    "Best in Class": "BestInClass"
}
# ===============================================

def find_and_replace(folder_path, find_replace_map):
    """
    Выполняет поиск и замену текста в YAML-заголовке всех .md файлах в указанной папке.

    :param folder_path: Путь к папке с файлами Markdown.
    :param find_replace_map: Словарь, где ключ - текст для поиска, а значение - текст для замены.
    """
    print(f"Начинаю обработку YAML-заголовков в папке: {folder_path}\n")
    updated_files_count = 0
    processed_files_count = 0

    # os.scandir() эффективнее для больших директорий, чем os.listdir()
    for entry in os.scandir(folder_path):
        # Обрабатываем только файлы с расширением .md
        if entry.is_file() and entry.name.lower().endswith(".md"):
            processed_files_count += 1
            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    original_content = f.read()
            except IOError as e:
                print(f"Ошибка чтения файла {entry.name}: {e}", file=sys.stderr)
                continue  # Переходим к следующему файлу

            # Проверяем наличие и корректность YAML-заголовка
            if not original_content.startswith('---'):
                continue # Пропускаем файлы без YAML-заголовка

            parts = original_content.split('---', 2)
            if len(parts) < 3:
                continue # Пропускаем файлы с некорректным заголовком (нет закрывающего '---')

            # parts[1] - содержимое YAML-заголовка
            # parts[2] - остальное содержимое файла
            original_frontmatter = parts[1]
            body = parts[2]

            # Выполняем замены только в YAML-заголовке
            modified_frontmatter = original_frontmatter
            for find_text, replace_text in find_replace_map.items():
                modified_frontmatter = modified_frontmatter.replace(find_text, replace_text)

            # Перезаписываем файл, только если в YAML-заголовке были изменения
            if modified_frontmatter != original_frontmatter:
                new_content = f"---{modified_frontmatter}---{body}"
                try:
                    with open(entry.path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"  - Обновлен YAML в файле: {entry.name}")
                    updated_files_count += 1
                except IOError as e:
                    print(f"Ошибка записи в файл {entry.name}: {e}", file=sys.stderr)

    print(f"\nОбработка завершена. Всего обработано файлов: {processed_files_count}. Обновлено: {updated_files_count}.")

def main():
    """Основная функция для запуска скрипта."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    folder_path = os.path.join(script_dir, FOLDER_NAME)

    if not os.path.isdir(folder_path):
        print(f"Ошибка: Папка '{folder_path}' не найдена.", file=sys.stderr)
        sys.exit(1)

    find_and_replace(folder_path, FIND_REPLACE_MAP)

if __name__ == "__main__":
    main()
