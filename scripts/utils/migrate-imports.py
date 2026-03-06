#!/usr/bin/env python3
"""
Script to update imports after DDD migration.
Replaces old lib/ relative/alias imports with new @/contexts/ and @/shared/ paths.
"""
import os
import re
import sys

# Mapping: old module name (without ./ or @/lib/) → new full path alias
IMPORT_MAP = {
    # Shared
    'types': '@/shared/types',
    'logger': '@/shared/utils/Logger',
    'pii': '@/shared/utils/PiiFilter',
    'cache-persistent': '@/shared/infrastructure/PersistentCache',
    # legal-search: use-cases
    'rag': '@/contexts/legal-search/application/use-cases/RunRagPipelineUseCase',
    'rag-recursive': '@/contexts/legal-search/application/use-cases/RunRecursiveRagUseCase',
    # legal-search: domain services
    'retrieval': '@/contexts/legal-search/domain/services/RetrievalService',
    'reranking': '@/contexts/legal-search/domain/services/RerankingService',
    'query-analyzer': '@/contexts/legal-search/domain/services/QueryAnalyzerService',
    'query-expansion': '@/contexts/legal-search/domain/services/QueryExpansionService',
    'query-splitter': '@/contexts/legal-search/domain/services/QuerySplitterService',
    'query-decomposer': '@/contexts/legal-search/domain/services/QueryDecomposerService',
    'response-synthesizer': '@/contexts/legal-search/domain/services/ResponseSynthesizerService',
    # legal-search: domain value-objects
    'response-structure': '@/contexts/legal-search/domain/value-objects/HnacStructure',
    # legal-search: infrastructure
    'generation': '@/contexts/legal-search/infrastructure/llm/GenerationService',
    'prompt-templates': '@/contexts/legal-search/infrastructure/llm/PromptTemplates',
    'embeddings': '@/contexts/legal-search/infrastructure/embeddings/EmbeddingService',
    'vector-index': '@/contexts/legal-search/infrastructure/vector-store/HnswVectorStore',
    'bm25': '@/contexts/legal-search/infrastructure/sparse-search/Bm25SearchService',
    # legal-knowledge: domain services
    'norm-extractor': '@/contexts/legal-knowledge/domain/services/NormExtractorService',
    'norm-vigencia': '@/contexts/legal-knowledge/domain/services/NormVigenciaService',
    'hierarchy-explainer': '@/contexts/legal-knowledge/domain/services/LegalHierarchyService',
    'legal-calculator': '@/contexts/legal-knowledge/domain/services/LegalCalculatorService',
    'procedures': '@/contexts/legal-knowledge/domain/services/ProceduresService',
    # legal-knowledge: infrastructure
    'legal-docs': '@/contexts/legal-knowledge/infrastructure/LegalDocumentRepository',
    # answer-quality: domain services
    'factual-validator': '@/contexts/answer-quality/domain/services/FactualValidatorService',
    'citation-validator': '@/contexts/answer-quality/domain/services/CitationValidatorService',
    'logic-validator': '@/contexts/answer-quality/domain/services/LogicValidatorService',
    'hnac-validator': '@/contexts/answer-quality/domain/services/HnacValidatorService',
    'source-comparator': '@/contexts/answer-quality/domain/services/SourceComparatorService',
    # identity: infrastructure
    'auth': '@/contexts/identity/infrastructure/AuthService',
    'auth-config': '@/contexts/identity/infrastructure/AuthConfig',
    'db-postgres': '@/contexts/identity/infrastructure/PostgresRepository',
    # subscription: domain services
    'tiers': '@/contexts/subscription/domain/services/TierService',
    'rate-limit-persistent': '@/contexts/subscription/domain/services/RateLimitService',
    # subscription: infrastructure
    'stripe': '@/contexts/subscription/infrastructure/StripeAdapter',
    # analytics: infrastructure
    'tracing': '@/contexts/analytics/infrastructure/TracingService',
    'ragas-integration': '@/contexts/analytics/infrastructure/RagasIntegration',
}

def escape_for_regex(s):
    return re.escape(s)

def replace_imports_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    for old_module, new_path in IMPORT_MAP.items():
        # Replace relative imports: from './module' or from './module'
        # Patterns: from './xxx' and from "./xxx" and require('./xxx') and require("./xxx")
        patterns = [
            (f"from './{old_module}'", f"from '{new_path}'"),
            (f'from "./{old_module}"', f'from "{new_path}"'),
            (f"from '@/lib/{old_module}'", f"from '{new_path}'"),
            (f'from "@/lib/{old_module}"', f'from "{new_path}"'),
            (f"require('@/lib/{old_module}')", f"require('{new_path}')"),
            (f'require("@/lib/{old_module}")', f'require("{new_path}")'),
            (f"require('./{old_module}')", f"require('{new_path}')"),
            (f'require("./{old_module}")', f'require("{new_path}")'),
        ]
        for old, new in patterns:
            content = content.replace(old, new)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Updated: {filepath}")
    return content != original


def process_directory(directory, extensions=('.ts', '.tsx', '.js', '.mjs')):
    updated = 0
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and .next
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
        for filename in files:
            if any(filename.endswith(ext) for ext in extensions):
                filepath = os.path.join(root, filename)
                if replace_imports_in_file(filepath):
                    updated += 1
    return updated

if __name__ == '__main__':
    base = '/home/lesaint/Documentos/Cursor/ColLawRAG'
    dirs_to_process = [
        os.path.join(base, 'src'),
        os.path.join(base, 'app'),
    ]
    total = 0
    for d in dirs_to_process:
        print(f"\nProcessing {d}...")
        n = process_directory(d)
        total += n
        print(f"  {n} files updated")
    print(f"\nTotal files updated: {total}")
