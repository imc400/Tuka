import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section id="inicio" className="pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 border border-purple-200 rounded-full">
              <span className="text-sm font-semibold text-purple-700">
                Beta - 100% Gratis mientras estamos en Beta
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
              Tu tienda Shopify en una{' '}
              <span className="text-purple-600">app móvil real</span>
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed">
              No necesitas presupuesto para desarrollar una app. Conecta tu tienda Shopify a Grumo y tus clientes podrán comprarte desde una app nativa en iOS y Android.
            </p>

            {/* Key benefits */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-700">Envía notificaciones push ilimitadas gratis</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-700">Tus clientes te compran desde la app, no desde el navegador</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-700">Sin comisiones por venta durante el Beta</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/admin"
                className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors"
              >
                Conectar mi tienda gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Ver cómo funciona
              </a>
            </div>

            {/* Trust */}
            <p className="text-sm text-gray-500">
              Más de 100 tiendas Shopify ya están en Grumo
            </p>
          </div>

          {/* Right Content - Phone Mockup with Lock Screen */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              {/* Phone Frame */}
              <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-950 rounded-[2.5rem] overflow-hidden w-[280px] h-[580px] relative">
                  {/* Dynamic Island */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full"></div>

                  {/* Status Bar */}
                  <div className="px-8 pt-14 flex justify-between items-center text-xs text-white/90">
                    <span className="font-medium">9:41</span>
                    <div className="flex gap-1 items-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3C7.46 3 3.34 4.78.29 7.67c-.18.18-.29.43-.29.71 0 .28.11.53.29.71l11 11c.39.39 1.02.39 1.41 0l11-11c.18-.18.29-.43.29-.71 0-.28-.11-.53-.29-.71C20.66 4.78 16.54 3 12 3z"/>
                      </svg>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2 22h20V2z"/>
                      </svg>
                      <div className="w-6 h-3 bg-white/90 rounded-sm relative">
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-green-400 rounded-sm"></div>
                      </div>
                    </div>
                  </div>

                  {/* Lock Screen Content */}
                  <div className="px-6 pt-8 text-center text-white">
                    <div className="text-5xl font-light mb-1">9:41</div>
                    <div className="text-lg font-light opacity-80">miercoles, 27 de noviembre</div>
                  </div>

                  {/* Notifications Container */}
                  <div className="absolute bottom-24 left-3 right-3 space-y-2 overflow-hidden">
                    {/* Notification 1 */}
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg animate-notification-1">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src="/grumo-isotipo-trimmed.png" alt="Grumo" className="w-7 h-7 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="text-[11px] text-gray-500 font-medium">GRUMO</div>
                            <div className="text-[10px] text-gray-400">ahora</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">Tu marca</div>
                          <div className="text-xs text-gray-600 truncate">Tu mensaje</div>
                        </div>
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-[8px] text-gray-400 font-medium border border-gray-200">
                          Tu logo
                        </div>
                      </div>
                    </div>

                    {/* Notification 2 */}
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg animate-notification-2">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src="/grumo-isotipo-trimmed.png" alt="Grumo" className="w-7 h-7 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="text-[11px] text-gray-500 font-medium">GRUMO</div>
                            <div className="text-[10px] text-gray-400">ahora</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">Tienes Shopify?</div>
                          <div className="text-xs text-gray-600 truncate">Puedes estar en Grumo</div>
                        </div>
                      </div>
                    </div>

                    {/* Notification 3 */}
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg animate-notification-3">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src="/grumo-isotipo-trimmed.png" alt="Grumo" className="w-7 h-7 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="text-[11px] text-gray-500 font-medium">GRUMO</div>
                            <div className="text-[10px] text-gray-400">ahora</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">Estamos en Beta</div>
                          <div className="text-xs text-gray-600 truncate">Unete, 100% gratis</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Home Indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/50 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
