/**
 * Setup file para Jest
 * Configuración global para todos los tests
 */

// Usar BD en memoria para no tocar data/users.db
if (!process.env.COLLAWRAG_TEST_DB) {
  process.env.COLLAWRAG_TEST_DB = ':memory:'
}

// Configurar variables de entorno de prueba si no están configuradas
if (!process.env.HUGGINGFACE_API_KEY) {
  process.env.HUGGINGFACE_API_KEY = 'hf_test_key_for_testing'
}

if (!process.env.HF_EMBEDDING_MODEL) {
  process.env.HF_EMBEDDING_MODEL = 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
}

if (!process.env.HF_GENERATION_MODEL) {
  process.env.HF_GENERATION_MODEL = 'meta-llama/llama-3.3-70b-instruct'
}

// Aumentar timeout para tests que hacen llamadas a APIs externas
jest.setTimeout(30000)

// Mock de console para tests más limpios (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// }
