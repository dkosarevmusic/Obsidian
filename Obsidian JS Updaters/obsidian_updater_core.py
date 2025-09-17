import re
from dataclasses import dataclass
from typing import Optional

# --- КОНСТАНТЫ ---
SEPARATOR_CONFIG_NAME = "separator_remove.yml"
# Регулярное выражение для поиска frontmatter
FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?\n)---\s*\n', re.DOTALL)
# Регулярное выражение для анализа: находит блок и опционально разделитель после него
DATAVIEWJS_BLOCK_RE = re.compile(r"(```dataviewjs.*?\n```)(\s*---\s*\n)?", re.DOTALL)
# Регулярное выражение для операции удаления: находит блок, ТОЛЬКО если за ним есть разделитель
SEPARATOR_REMOVAL_RE = re.compile(r"(```dataviewjs.*?\n```)\s*---\s*\n", re.DOTALL)


@dataclass
class AnalysisResult:
    """Структура для хранения результатов анализа файла."""
    file_path: str
    is_target: bool
    area: str = "[No Area]"
    file_type: Optional[str] = "[No Type]"
    has_target_type: bool = False
    has_non_target_type: bool = False
    block_count: int = 0
    separators_found_count: int = 0
    error: Optional[str] = None

def format_yaml_value(value: any, default: str) -> str:
    """Форматирует значение из YAML (строку или список строк) в единую строку."""
    if not value:
        return default
    return ", ".join(map(str, value)) if isinstance(value, list) else str(value)