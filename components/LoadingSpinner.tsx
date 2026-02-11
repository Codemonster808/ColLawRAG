export default function LoadingSpinner({ message = 'Procesando consulta...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative">
        {/* Spinner principal */}
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        {/* Spinner secundario (más pequeño, rotación inversa) */}
        <div className="absolute top-2 left-2 w-12 h-12 border-4 border-indigo-200 border-b-indigo-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
      </div>
      <p className="mt-4 text-gray-600 font-medium">{message}</p>
      <p className="mt-2 text-sm text-gray-500">Esto puede tardar 30-60 segundos</p>
      {/* Puntos animados */}
      <div className="flex space-x-1 mt-3">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  )
}
