import { X, Check, Globe, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const comparisons = [
  {
    feature: 'Notificaciones push',
    web: false,
    app: true,
    webNote: 'No disponible o ignoradas',
    appNote: 'Llegan directo al teléfono',
  },
  {
    feature: 'Icono en pantalla de inicio',
    web: false,
    app: true,
    webNote: 'Se pierde entre pestañas',
    appNote: 'Siempre visible y accesible',
  },
  {
    feature: 'Velocidad de carga',
    web: false,
    app: true,
    webNote: 'Depende del navegador',
    appNote: 'Instantánea y fluida',
  },
  {
    feature: 'Recordación de marca',
    web: false,
    app: true,
    webNote: 'Los clientes se olvidan',
    appNote: 'Tu logo siempre presente',
  },
  {
    feature: 'Experiencia de compra',
    web: false,
    app: true,
    webNote: 'Navegador incómodo',
    appNote: 'Nativa y optimizada',
  },
  {
    feature: 'Retención de clientes',
    web: false,
    app: true,
    webNote: 'Alta tasa de abandono',
    appNote: 'Clientes que vuelven',
  },
];

export default function AppVsWeb() {
  return (
    <section id="beneficios" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Por qué tus clientes deberían comprarte desde una app?
          </h2>
          <p className="text-lg text-gray-600">
            La gente olvida las páginas web. Las apps se quedan en su teléfono, siempre visibles, siempre accesibles.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto">
          {/* Headers */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div></div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl mb-2">
                <Globe className="w-6 h-6 text-gray-400" />
              </div>
              <div className="font-semibold text-gray-400">Página Web</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-2">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <div className="font-semibold text-purple-600">App Grumo</div>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-3">
            {comparisons.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 items-center p-4 bg-gray-50 rounded-xl"
              >
                <div className="font-medium text-gray-900">{item.feature}</div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 bg-red-100 rounded-full mb-1">
                    <X className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-xs text-gray-500">{item.webNote}</div>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mb-1">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-xs text-gray-600">{item.appNote}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom message */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
            <p className="text-lg text-gray-700 mb-4">
              <span className="font-semibold">El 85% de los usuarios</span> prefiere comprar desde apps que desde páginas web. Con Grumo, tu tienda está donde tus clientes quieren comprar.
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Llevar mi tienda a la app
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
