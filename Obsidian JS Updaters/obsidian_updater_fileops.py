import os
import shutil
from datetime import datetime
from typing import List, Callable

from obsidian_updater_core import AnalysisResult

def archive_and_modify_files(results: List[AnalysisResult], vault_path: str, modification_func: Callable) -> int:
    """
    Архивирует файлы, а затем изменяет их с помощью предоставленной функции.
    """
    if not results:
        return 0

    # --- Создание директории для архива ---
    try:
        archive_base_dir = os.path.join(os.path.dirname(vault_path), "Archive", "Obsidian Updater Archive")
        timestamp_dir = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        archive_run_dir = os.path.join(archive_base_dir, timestamp_dir)
        os.makedirs(archive_run_dir, exist_ok=True)
        print(f"\n🗄️ Создан архив для этой сессии: '{archive_run_dir}'")
    except Exception as e:
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось создать директорию для архива: {e}")
        print("🚫 Замена отменена для предотвращения потери данных.")
        return 0

    modified_count = 0
    for res in results:
        try:
            # --- Архивирование файла ---
            relative_path = os.path.relpath(res.file_path, vault_path)
            backup_path = os.path.join(archive_run_dir, relative_path)
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            shutil.copy2(res.file_path, backup_path)

            # --- Замена содержимого ---
            with open(res.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content, num_replacements = modification_func(content)
            
            if num_replacements > 0:
                with open(res.file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_count += 1
        except Exception as e:
            print(f"❗️ Не удалось выполнить архивирование и замену в файле {res.file_path}: {e}")
    
    print(f"🚀 Операция завершена. Модифицировано {modified_count} из {len(results)} файлов.")
    return modified_count