#!/usr/bin/env python3
"""
FASE 3 - Tarea A: Analizar qué chunks se recuperan para queries laborales

Analiza el contenido del índice para verificar:
- ¿Los artículos esperados están en el índice?
- ¿Tienen metadata correcta (article, title)?
- ¿Cuántos chunks por norma?
"""

import json
import gzip
from pathlib import Path
from collections import defaultdict

# Test cases basados en el benchmark
TEST_CASES = [
    {
        'id': 'LAB-001',
        'query': '¿Cuántos días de vacaciones anuales tiene derecho un trabajador en Colombia?',
        'expected_articles': ['186', 'Art. 186', 'Artículo 186'],
        'expected_norm': 'Código Sustantivo del Trabajo'
    },
    {
        'id': 'LAB-002',
        'query': '¿Cuál es el salario mínimo legal en Colombia?',
        'expected_articles': ['145', 'Art. 145', 'Artículo 145'],
        'expected_norm': 'Código Sustantivo del Trabajo'
    },
    {
        'id': 'LAB-003',
        'query': '¿Qué es el auxilio de cesantías y cómo se calcula?',
        'expected_articles': ['249', 'Art. 249', 'Artículo 249'],
        'expected_norm': 'Código Sustantivo del Trabajo'
    },
    {
        'id': 'TRI-001',
        'query': '¿Cuál es la tarifa general del impuesto de renta para sociedades?',
        'expected_articles': ['240', 'Art. 240', 'Artículo 240'],
        'expected_norm': 'Estatuto Tributario'
    },
    {
        'id': 'TRI-002',
        'query': '¿Qué es el impuesto de industria y comercio (ICA)?',
        'expected_articles': ['195', 'Art. 195', 'Artículo 195', 'Decreto 1333'],
        'expected_norm': 'Decreto 1333'
    }
]

def load_index():
    """Carga el índice (comprimido o no)"""
    data_dir = Path('data')
    index_gz = data_dir / 'index.json.gz'
    index_json = data_dir / 'index.json'
    
    if index_gz.exists():
        print(f'📂 Loading {index_gz}...')
        with gzip.open(index_gz, 'rt', encoding='utf-8') as f:
            chunks = json.load(f)
        print(f'✅ Loaded {len(chunks)} chunks')
        return chunks
    elif index_json.exists():
        print(f'📂 Loading {index_json}...')
        with open(index_json, 'r', encoding='utf-8') as f:
            chunks = json.load(f)
        print(f'✅ Loaded {len(chunks)} chunks')
        return chunks
    else:
        print(f'❌ No index file found in {data_dir}')
        return []

def search_chunks(chunks, test_case):
    """Busca chunks relevantes para un test case"""
    matches = []
    partial_matches = []
    
    for chunk in chunks:
        metadata = chunk.get('metadata', {})
        title = metadata.get('title', '').lower()
        article = metadata.get('article', '').lower()
        content = chunk.get('content', '').lower()
        
        # Verificar si el chunk es del norm esperado
        is_from_norm = test_case['expected_norm'].lower() in title
        
        # Verificar si contiene alguno de los artículos esperados
        has_article = False
        matched_article = None
        for art in test_case['expected_articles']:
            art_lower = art.lower()
            if art_lower in article or art_lower in content[:500]:  # Primeros 500 chars
                has_article = True
                matched_article = art
                break
        
        if is_from_norm and has_article:
            matches.append({
                'chunk': chunk,
                'matched_article': matched_article,
                'title': metadata.get('title', 'No title'),
                'article': metadata.get('article', 'No article')
            })
        elif is_from_norm:
            partial_matches.append({
                'chunk': chunk,
                'title': metadata.get('title', 'No title'),
                'article': metadata.get('article', 'No article')
            })
    
    return matches, partial_matches

def analyze_corpus(chunks):
    """Analiza la composición del corpus"""
    by_type = defaultdict(int)
    by_norm = defaultdict(int)
    articles_with_metadata = 0
    
    for chunk in chunks:
        metadata = chunk.get('metadata', {})
        chunk_type = metadata.get('type', 'unknown')
        title = metadata.get('title', 'unknown')
        article = metadata.get('article')
        
        by_type[chunk_type] += 1
        by_norm[title] += 1
        
        if article:
            articles_with_metadata += 1
    
    return {
        'total_chunks': len(chunks),
        'by_type': dict(by_type),
        'by_norm': dict(sorted(by_norm.items(), key=lambda x: x[1], reverse=True)[:20]),
        'articles_with_metadata': articles_with_metadata,
        'articles_percentage': (articles_with_metadata / len(chunks) * 100) if chunks else 0
    }

def main():
    print('🔬 FASE 3 - Tarea A: Análisis de Corpus e Índice\n')
    
    # Cargar índice
    chunks = load_index()
    if not chunks:
        return
    
    # Analizar corpus
    print('\n📊 Análisis del Corpus:')
    print('=' * 80)
    corpus_stats = analyze_corpus(chunks)
    print(f'Total chunks: {corpus_stats["total_chunks"]:,}')
    print(f'Chunks con metadata de artículo: {corpus_stats["articles_with_metadata"]:,} ({corpus_stats["articles_percentage"]:.1f}%)')
    
    print('\n📚 Top 20 normas por cantidad de chunks:')
    for norm, count in list(corpus_stats['by_norm'].items())[:20]:
        print(f'  {norm}: {count:,} chunks')
    
    print('\n📝 Chunks por tipo:')
    for ctype, count in corpus_stats['by_type'].items():
        print(f'  {ctype}: {count:,} chunks')
    
    # Analizar test cases
    print('\n' + '=' * 80)
    print('🔍 Análisis de Test Cases:')
    print('=' * 80)
    
    results = []
    
    for test_case in TEST_CASES:
        print(f'\n{test_case["id"]}: {test_case["query"]}')
        print(f'Expected: {test_case["expected_norm"]} - {", ".join(test_case["expected_articles"])}')
        print('-' * 80)
        
        matches, partial_matches = search_chunks(chunks, test_case)
        
        if matches:
            print(f'✅ Found {len(matches)} exact matches:')
            for i, match in enumerate(matches[:5], 1):
                print(f'  {i}. {match["title"]} — {match["article"]}')
                print(f'     Content preview: {match["chunk"]["content"][:150]}...')
        else:
            print(f'❌ No exact matches found')
        
        if partial_matches:
            print(f'\n⚠️  Found {len(partial_matches)} partial matches (correct norm, missing article):')
            for i, match in enumerate(partial_matches[:5], 1):
                print(f'  {i}. {match["title"]} — {match["article"]}')
        
        result = {
            'test_id': test_case['id'],
            'exact_matches': len(matches),
            'partial_matches': len(partial_matches),
            'found': len(matches) > 0
        }
        results.append(result)
    
    # Summary
    print('\n' + '=' * 80)
    print('📈 Summary:')
    print('=' * 80)
    
    found_count = sum(1 for r in results if r['found'])
    print(f'Test cases with exact matches: {found_count}/{len(results)}')
    
    for result in results:
        status = '✅' if result['found'] else '❌'
        print(f'  {status} {result["test_id"]}: {result["exact_matches"]} exact, {result["partial_matches"]} partial')
    
    # Guardar resultados
    output_path = Path('data/analysis/corpus-analysis.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': '2026-02-24T10:00:00Z',
            'corpus_stats': corpus_stats,
            'test_results': results,
            'summary': {
                'total_tests': len(results),
                'tests_with_matches': found_count,
                'success_rate': (found_count / len(results) * 100) if results else 0
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f'\n✅ Results saved to {output_path}')

if __name__ == '__main__':
    main()
