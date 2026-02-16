#!/usr/bin/env python3
"""
generate_toon_payload.py — Generador de payloads TOON reales

Convierte JSON estructurado (o texto plano) a formato TOON
(Token-Oriented Object Notation) conforme a la spec oficial.

TOON spec: https://github.com/toon-format/spec/blob/main/SPEC.md
  - ~40% menos tokens que JSON
  - Arrays de objetos → formato tabular CSV-style
  - Objetos escalares → YAML-style
  - Strings con comas/saltos → entre comillas

Modos de uso:
    # Desde texto plano (por defecto guarda en archivo .toon)
    python generate_toon_payload.py "Usuario: Ana, Edad: 30, Activo: sí"
    # → Genera: Usuario_YYYYMMDD_HHMMSS.toon

    # Desde JSON (modo principal — conversión exacta)
    python generate_toon_payload.py --json data.json
    # → Genera: data_YYYYMMDD_HHMMSS.toon

    # Desde stdin
    echo '{"name":"Ana","age":30}' | python generate_toon_payload.py --stdin

    # Modo interactivo
    python generate_toon_payload.py --interactive

    # Especificar nombre de archivo
    python generate_toon_payload.py "texto" --output mi_archivo.toon

    # Solo mostrar en terminal (no guardar archivo)
    python generate_toon_payload.py "texto" --no-file

    # Solo TOON puro (sin decoración — útil para pipelines)
    python generate_toon_payload.py --json data.json --raw
"""

import sys
import json
import argparse
import re
from typing import Any, Dict, List, Optional, Union


# ─── TOON Encoder (fiel a la spec) ────────────────────────────────────────────

def _needs_quotes(value: str) -> bool:
    """
    Un string necesita comillas si:
    - Contiene coma
    - Contiene salto de línea
    - Empieza con comilla doble
    - Es exactamente 'true', 'false', 'null' (evitar ambigüedad)
    - Es un número en string (evitar que se interprete como número)
    """
    if not isinstance(value, str):
        return False
    if value in ('true', 'false', 'null'):
        return True
    if ',' in value or '\n' in value or value.startswith('"'):
        return True
    # Si parece número, no necesita comillas (se codifica sin ellas, el decoder lo sabe)
    try:
        float(value)
        # Es un número en string → en TOON los strings-numéricos necesitan comillas
        # para distinguirlos de números reales. Pero solo si queremos preservar el tipo.
        # En la práctica TOON trata todo como string si no hay tipo explícito.
        # Solo ponemos comillas si el string empieza con espacio o tiene caracteres especiales.
    except ValueError:
        pass
    return False


def _encode_scalar(value: Any) -> str:
    """Codifica un valor escalar a su representación TOON."""
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        if _needs_quotes(value):
            # Escapar comillas internas
            escaped = value.replace('"', '\\"')
            return f'"{escaped}"'
        return value
    # Fallback
    return str(value)


def _all_same_keys(items: list) -> bool:
    """Comprueba si todos los dicts de la lista tienen exactamente las mismas claves."""
    if not items or not isinstance(items[0], dict):
        return False
    first_keys = list(items[0].keys())
    return all(
        isinstance(item, dict) and list(item.keys()) == first_keys
        for item in items
    )


def _encode_toon(data: Any, indent: int = 0) -> str:
    """
    Encoder TOON recursivo, fiel a la spec:
    - Objetos → YAML-style key: value
    - Arrays de objetos uniformes → formato tabular key[N]{f1,f2}:
    - Arrays primitivos → key[N]: v1,v2,v3
    - Arrays no uniformes → YAML-style con guiones
    """
    pad = '  ' * indent
    lines: List[str] = []

    if isinstance(data, dict):
        for key, value in data.items():
            # Sanear la clave (sin espacios ni caracteres especiales)
            safe_key = str(key).strip()

            if value is None:
                lines.append(f'{pad}{safe_key}: null')

            elif isinstance(value, bool):
                lines.append(f'{pad}{safe_key}: {"true" if value else "false"}')

            elif isinstance(value, (int, float)):
                lines.append(f'{pad}{safe_key}: {value}')

            elif isinstance(value, str):
                lines.append(f'{pad}{safe_key}: {_encode_scalar(value)}')

            elif isinstance(value, list):
                if len(value) == 0:
                    lines.append(f'{pad}{safe_key}[0]:')

                elif _all_same_keys(value):
                    # ← NÚCLEO DE TOON: formato tabular para arrays de objetos uniformes
                    fields = list(value[0].keys())
                    header = f'{pad}{safe_key}[{len(value)}]{{{",".join(fields)}}}:'
                    lines.append(header)
                    for item in value:
                        row_values = []
                        for field in fields:
                            row_values.append(_encode_scalar(item.get(field)))
                        row = ','.join(row_values)
                        lines.append(f'{pad}  {row}')

                elif all(not isinstance(v, (dict, list)) for v in value):
                    # Array de primitivos → inline
                    encoded = ','.join(_encode_scalar(v) for v in value)
                    lines.append(f'{pad}{safe_key}[{len(value)}]: {encoded}')

                else:
                    # Array no uniforme → YAML-style con guiones
                    lines.append(f'{pad}{safe_key}:')
                    for item in value:
                        if isinstance(item, dict):
                            # Primer campo con guión, resto indentado
                            item_lines = _encode_toon(item, indent + 2).split('\n')
                            if item_lines:
                                lines.append(f'{pad}  - {item_lines[0].lstrip()}')
                                for il in item_lines[1:]:
                                    lines.append(f'{pad}    {il.lstrip()}')
                        else:
                            lines.append(f'{pad}  - {_encode_scalar(item)}')

            elif isinstance(value, dict):
                lines.append(f'{pad}{safe_key}:')
                lines.append(_encode_toon(value, indent + 1))

            else:
                lines.append(f'{pad}{safe_key}: {_encode_scalar(value)}')

    elif isinstance(data, list):
        # Lista raíz (poco común, pero soportado)
        if _all_same_keys(data):
            fields = list(data[0].keys())
            lines.append(f'items[{len(data)}]{{{",".join(fields)}}}:')
            for item in data:
                row = ','.join(_encode_scalar(item.get(f)) for f in fields)
                lines.append(f'  {row}')
        else:
            for item in data:
                if isinstance(item, dict):
                    item_lines = _encode_toon(item, 1).split('\n')
                    if item_lines:
                        lines.append(f'- {item_lines[0].lstrip()}')
                        for il in item_lines[1:]:
                            lines.append(f'  {il.lstrip()}')
                else:
                    lines.append(f'- {_encode_scalar(item)}')
    else:
        return _encode_scalar(data)

    return '\n'.join(line for line in lines if line is not None)


def encode(data: Any) -> str:
    """
    Convierte cualquier estructura Python a TOON real.
    Punto de entrada principal.
    """
    return _encode_toon(data)


# ─── Contador de tokens (aproximado) ──────────────────────────────────────────

def count_tokens(text: str) -> int:
    """Aproximación GPT-style: ~3.5 chars/token en español."""
    return max(1, round(len(text) / 3.5))


# ─── Parser de texto plano → dict ─────────────────────────────────────────────

def _normalize_bool(value: str) -> Any:
    """Normaliza strings a bool/None si corresponde."""
    v = value.strip().lower()
    if v in ('sí', 'si', 'yes', 'true', 'activo', 'habilitado', 'vigente', 'completado', 'completada'):
        return True
    if v in ('no', 'false', 'inactivo', 'deshabilitado', 'no vigente', 'pendiente',
             'no completada', 'no completado'):
        return False
    if v == 'null' or v == 'nulo' or v == 'ninguno':
        return None
    # Intentar número
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return value.strip()


def _parse_kv_text(text: str) -> Optional[Dict]:
    """
    Extrae pares clave:valor de texto como:
    "Nombre: Ana, Edad: 30, Ciudad: Bogotá, Activo: sí"
    """
    # Dividir por separadores entre campos
    pattern = r',\s*(?=[A-Za-záéíóúñÁÉÍÓÚÑ_\s]+\s*:)'
    parts = re.split(pattern, text)

    result = {}
    for part in parts:
        m = re.match(r'^([^:]+?):\s*(.+)$', part.strip(), re.DOTALL)
        if m:
            key = m.group(1).strip().lower().replace(' ', '_').rstrip('.')
            value = m.group(2).strip().rstrip('.,')
            if key:
                result[key] = _normalize_bool(value)

    return result if len(result) >= 2 else None


def _parse_project_tasks(text: str) -> Optional[Dict]:
    """
    Parsea texto de proyectos con tareas en paréntesis:
    "El proyecto Alfa tiene 3 tareas: Diseño (alta, completada), ..."
    """
    result: Dict[str, Any] = {}

    # Nombre del proyecto
    m = re.search(r'proyecto\s+["\']?([A-Za-záéíóúñ\s]+?)["\']?\s*(?:tiene|con|:)', text, re.IGNORECASE)
    if m:
        result['nombre'] = m.group(1).strip()

    # Equipo
    m = re.search(r'equipo[:\s]+([^\.\n,]+)', text, re.IGNORECASE)
    if m:
        result['equipo'] = m.group(1).strip().rstrip('.')

    # Tareas: Nombre (prioridad, estado)
    tasks = []
    for tm in re.finditer(r'([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-Za-záéíóúñ]+)?)\s*\(([^)]+)\)', text):
        tname = tm.group(1).strip()
        details = tm.group(2).lower()

        priority = next((p for p in ('alta', 'media', 'baja') if p in details), None)

        if 'no completada' in details or 'no completado' in details or 'pendiente' in details:
            completed = False
        elif 'completada' in details or 'completado' in details:
            completed = True
        else:
            completed = None

        task: Dict[str, Any] = {'nombre': tname}
        if priority:
            task['prioridad'] = priority
        if completed is not None:
            task['completada'] = completed
        tasks.append(task)

    if tasks:
        result['tareas'] = tasks

    return result if result else None


def _parse_legal_query(text: str) -> Optional[Dict]:
    """Detecta consultas de tipo jurídico y genera estructura útil."""
    legal_kw = ['ley', 'artículo', 'código', 'decreto', 'sentencia', 'tutela',
                'colombia', 'jurisprudencia', 'norma', 'laboral', 'constitucional']
    if not any(kw in text.lower() for kw in legal_kw):
        return None

    area = 'general'
    text_l = text.lower()
    if any(w in text_l for w in ['laboral', 'trabajo', 'salario', 'prestaciones', 'despido']):
        area = 'laboral'
    elif any(w in text_l for w in ['tutela', 'constitucional', 'corte']):
        area = 'constitucional'
    elif any(w in text_l for w in ['penal', 'delito', 'crimen']):
        area = 'penal'
    elif any(w in text_l for w in ['civil', 'contrato', 'propiedad']):
        area = 'civil'

    return {
        'query': text.strip(),
        'area_legal': area,
        'locale': 'es',
    }


def text_to_dict(text: str) -> Dict:
    """
    Intenta extraer estructura de texto plano usando heurísticas.
    Si no puede, retorna estructura genérica.
    """
    # 1. Proyecto con tareas
    if re.search(r'proyecto\s+\w+', text, re.IGNORECASE) and '(' in text:
        parsed = _parse_project_tasks(text)
        if parsed and ('tareas' in parsed or 'nombre' in parsed):
            return parsed

    # 2. Solicitud de documentación/proyecto
    if any(word in text.lower() for word in ['generar', 'documentacion', 'documentación', 'tech stack', 'arquitectura']):
        doc_request = _parse_documentation_request(text)
        if doc_request:
            return doc_request

    # 3. Consulta legal
    legal = _parse_legal_query(text)
    if legal:
        return legal

    # 4. Pares clave-valor
    kv = _parse_kv_text(text)
    if kv and len(kv) >= 2:
        return kv

    # 5. Lista separada por comas/numeración
    items_match = re.findall(r'(?:\d+[\.\)]\s*|[-•]\s*)([^\n,]+)', text)
    if len(items_match) >= 2:
        return {'items': [i.strip() for i in items_match]}

    # 6. Fallback: texto como campo único
    return {'texto': text.strip()}


def _parse_documentation_request(text: str) -> Optional[Dict]:
    """Parsea solicitudes de documentación de proyectos."""
    result = {}
    text_lower = text.lower()
    
    # Extraer ruta del proyecto
    path_match = re.search(r'(/[^\s]+|\.\w+)', text)
    if path_match:
        result['ruta_proyecto'] = path_match.group(1)
    
    # Detectar acción
    if 'generar' in text_lower or 'crear' in text_lower:
        result['accion'] = 'generar'
    elif 'actualizar' in text_lower or 'actualizar' in text_lower:
        result['accion'] = 'actualizar'
    
    # Extraer elementos solicitados
    elementos = []
    if 'tech stack' in text_lower or 'tecnologías' in text_lower or 'tecnologia' in text_lower:
        elementos.append('tech_stack')
    if 'arquitectura' in text_lower:
        elementos.append('arquitectura')
    if 'diagrama' in text_lower:
        elementos.append('diagrama')
    if 'explicación' in text_lower or 'explicacion' in text_lower or 'como esta hecho' in text_lower:
        elementos.append('explicacion')
    if 'mejoras' in text_lower or 'mejora' in text_lower:
        elementos.append('mejoras')
    if 'documentación' in text_lower or 'documentacion' in text_lower:
        elementos.append('documentacion')
    
    if elementos:
        result['elementos'] = elementos
    
    # Tipo de solicitud
    result['tipo'] = 'documentacion_proyecto'
    
    return result if len(result) > 1 else None


# ─── Comparación JSON vs TOON ─────────────────────────────────────────────────

def stats(original_json: str, toon_str: str) -> Dict:
    json_tokens = count_tokens(original_json)
    toon_tokens = count_tokens(toon_str)
    saved = json_tokens - toon_tokens
    pct = (saved / json_tokens * 100) if json_tokens > 0 else 0
    return {
        'json_chars': len(original_json),
        'toon_chars': len(toon_str),
        'json_tokens': json_tokens,
        'toon_tokens': toon_tokens,
        'saved_tokens': saved,
        'saved_pct': round(pct, 1),
    }


# ─── Modo interactivo ─────────────────────────────────────────────────────────

def run_interactive():
    print('\n' + '═' * 60)
    print('  🎒 Generador TOON — Token-Oriented Object Notation')
    print('  ~40% menos tokens que JSON | fiel a la spec oficial')
    print('═' * 60)
    print('\nModos de entrada:')
    print('  1. Texto libre (heurístico)')
    print('  2. JSON en línea')
    print('  3. Ruta a archivo JSON')
    print('\nEscribe "salir" para terminar.\n')

    while True:
        try:
            raw = input('Entrada > ').strip()

            if not raw or raw.lower() in ('salir', 'exit', 'quit'):
                print('\n👋 ¡Hasta luego!')
                break

            # ¿Es JSON en línea?
            data = None
            json_str = None
            if raw.startswith('{') or raw.startswith('['):
                try:
                    data = json.loads(raw)
                    json_str = json.dumps(data, ensure_ascii=False, indent=2)
                except json.JSONDecodeError:
                    pass

            # ¿Es ruta a archivo?
            if data is None and (raw.startswith('/') or raw.endswith('.json')):
                try:
                    with open(raw, encoding='utf-8') as f:
                        data = json.load(f)
                    json_str = json.dumps(data, ensure_ascii=False, indent=2)
                    print(f'  ✓ JSON cargado: {raw}')
                except (FileNotFoundError, json.JSONDecodeError) as e:
                    print(f'  ⚠ No se pudo leer como JSON: {e}')

            # Fallback: texto plano
            if data is None:
                data = text_to_dict(raw)
                json_str = json.dumps(data, ensure_ascii=False, indent=2)

            toon = encode(data)
            s = stats(json_str, toon)

            print('\n' + '─' * 60)
            print('🎒 TOON:')
            print('─' * 60)
            print(toon)
            print('─' * 60)
            print(f'📊 Tokens: JSON {s["json_tokens"]} → TOON {s["toon_tokens"]} '
                  f'| Ahorro: {s["saved_tokens"]} tokens ({s["saved_pct"]}%)')
            print()

        except KeyboardInterrupt:
            print('\n\n👋 ¡Hasta luego!')
            break
        except Exception as e:
            print(f'\n❌ Error: {e}\n')


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Convierte JSON o texto a formato TOON real (fiel a la spec)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Desde JSON (conversión exacta)
  python generate_toon_payload.py --json data.json

  # Inline JSON
  python generate_toon_payload.py --json '{"nombre":"Ana","edad":30}'

  # Desde stdin
  cat data.json | python generate_toon_payload.py --stdin

  # Texto libre (heurístico)
  python generate_toon_payload.py "Proyecto Alfa: 3 tareas: Diseño (alta, completada)"

  # Guardar output limpio
  python generate_toon_payload.py --json data.json --output result.toon --raw

  # Modo interactivo
  python generate_toon_payload.py --interactive
        """
    )

    parser.add_argument('input_text', nargs='?',
                        help='Texto libre a convertir (heurístico)')
    parser.add_argument('--json', '-j', metavar='JSON',
                        help='JSON como string o ruta a archivo .json')
    parser.add_argument('--stdin', action='store_true',
                        help='Leer JSON desde stdin')
    parser.add_argument('--file', '-f', metavar='FILE',
                        help='Archivo de texto plano de entrada')
    parser.add_argument('--output', '-o', metavar='FILE',
                        help='Guardar el TOON resultante en un archivo (por defecto se genera automáticamente)')
    parser.add_argument('--no-file', action='store_true',
                        help='No guardar archivo, solo mostrar en terminal')
    parser.add_argument('--raw', '-r', action='store_true',
                        help='Solo imprimir TOON (sin decoración ni stats)')
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Modo interactivo')
    parser.add_argument('--stats-only', action='store_true',
                        help='Mostrar solo estadísticas de tokens')

    args = parser.parse_args()

    # ── Modo interactivo ─────────────────────────────────────────────────────
    if args.interactive:
        run_interactive()
        return

    # ── Determinar fuente de datos ───────────────────────────────────────────
    data = None
    json_str = None

    if args.stdin:
        raw = sys.stdin.read().strip()
        try:
            data = json.loads(raw)
            json_str = json.dumps(data, ensure_ascii=False, indent=2)
        except json.JSONDecodeError as e:
            print(f'❌ JSON inválido desde stdin: {e}', file=sys.stderr)
            sys.exit(1)

    elif args.json:
        # ¿Es ruta a archivo?
        import os
        if os.path.isfile(args.json):
            try:
                with open(args.json, encoding='utf-8') as f:
                    data = json.load(f)
                json_str = json.dumps(data, ensure_ascii=False, indent=2)
            except (FileNotFoundError, json.JSONDecodeError) as e:
                print(f'❌ Error leyendo JSON: {e}', file=sys.stderr)
                sys.exit(1)
        else:
            # Intentar parsear como string JSON
            try:
                data = json.loads(args.json)
                json_str = json.dumps(data, ensure_ascii=False, indent=2)
            except json.JSONDecodeError as e:
                print(f'❌ JSON inválido: {e}', file=sys.stderr)
                sys.exit(1)

    elif args.file:
        try:
            with open(args.file, encoding='utf-8') as f:
                text = f.read().strip()
            data = text_to_dict(text)
            json_str = json.dumps(data, ensure_ascii=False, indent=2)
        except FileNotFoundError:
            print(f'❌ Archivo no encontrado: {args.file}', file=sys.stderr)
            sys.exit(1)

    elif args.input_text:
        raw = args.input_text.strip()
        # ¿Es JSON?
        if raw.startswith('{') or raw.startswith('['):
            try:
                data = json.loads(raw)
                json_str = json.dumps(data, ensure_ascii=False, indent=2)
            except json.JSONDecodeError:
                pass
        if data is None:
            data = text_to_dict(raw)
            json_str = json.dumps(data, ensure_ascii=False, indent=2)

    else:
        parser.print_help()
        sys.exit(0)

    # ── Generar TOON ──────────────────────────────────────────────────────────
    toon = encode(data)
    s = stats(json_str, toon)

    # ── Determinar nombre de archivo de salida ──────────────────────────────
    import os
    from datetime import datetime
    
    # Crear carpeta toon_payloads si no existe
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # Subir un nivel desde scripts/
    toon_dir = os.path.join(project_root, 'toon_payloads')
    os.makedirs(toon_dir, exist_ok=True)
    
    if args.output:
        # Si es ruta absoluta, usar tal cual; si es relativa, poner en toon_payloads
        if os.path.isabs(args.output):
            output_file = args.output
        else:
            output_file = os.path.join(toon_dir, args.output)
        if not output_file.endswith('.toon'):
            output_file = output_file + '.toon'
    else:
        # Generar nombre automático basado en timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Intentar usar primera palabra del input como nombre
        if args.input_text:
            first_word = args.input_text.split()[0] if args.input_text.split() else 'output'
            safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', first_word[:20])
            filename = f'{safe_name}_{timestamp}.toon'
        elif args.json:
            base = os.path.splitext(os.path.basename(args.json))[0] if os.path.isfile(args.json) else 'json'
            filename = f'{base}_{timestamp}.toon'
        elif args.file:
            base = os.path.splitext(os.path.basename(args.file))[0]
            filename = f'{base}_{timestamp}.toon'
        else:
            filename = f'output_{timestamp}.toon'
        
        output_file = os.path.join(toon_dir, filename)

    # ── Guardar en archivo .toon (a menos que --no-file) ────────────────────
    if not args.no_file:
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(toon)
        except Exception as e:
            print(f'❌ Error guardando archivo: {e}', file=sys.stderr)
            sys.exit(1)
    else:
        output_file = None

    # ── Output ────────────────────────────────────────────────────────────────
    if args.raw:
        # Solo mostrar TOON puro (sin decoración)
        print(toon)
    elif args.stats_only:
        print(json.dumps(s, indent=2))
    else:
        print('\n' + '═' * 60)
        print('  🎒 TOON (Token-Oriented Object Notation)')
        print('═' * 60)
        print()
        if output_file:
            print('📄 Archivo generado:')
            print(f'   {output_file}')
            print()
        print('📋 Contenido TOON:')
        print('─' * 60)
        print(toon)
        print('─' * 60)
        print()
        print('📊 Estadísticas:')
        print(f'   JSON:  {s["json_tokens"]:>5} tokens  ({s["json_chars"]} chars)')
        print(f'   TOON:  {s["toon_tokens"]:>5} tokens  ({s["toon_chars"]} chars)')
        print(f'   Ahorro: {s["saved_tokens"]} tokens ({s["saved_pct"]}% menos)')
        if s['saved_tokens'] > 0:
            cost_per_1m = 0.27  # USD/1M tokens DeepSeek V3.2
            cost_per_1k = round(s['saved_tokens'] * 1000 / 1_000_000 * cost_per_1m, 5)
            print(f'   A 1,000 queries/día: ~${cost_per_1k} USD/día ahorrados')
        if output_file:
            # Mostrar ruta relativa desde el proyecto
            rel_path = os.path.relpath(output_file, project_root) if os.path.isabs(output_file) else output_file
            print()
            print(f'✅ Archivo TOON guardado: {rel_path}')
        print('═' * 60)


if __name__ == '__main__':
    main()
