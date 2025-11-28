import { Bell, TrendingUp, Zap, Clock, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

const benefits = [
  {
    icon: Zap,
    title: 'Llega al instante',
    description: 'Tus clientes reciben la notificación inmediatamente en su teléfono.',
  },
  {
    icon: TrendingUp,
    title: '90% tasa de apertura',
    description: 'Las push notifications tienen 10x más engagement que el email.',
  },
  {
    icon: Target,
    title: 'Directo al bolsillo',
    description: 'Tu mensaje aparece en la pantalla de bloqueo de tus clientes.',
  },
  {
    icon: Clock,
    title: 'Programa envíos',
    description: 'Envía promociones en el momento perfecto desde tu dashboard.',
  },
];

export default function PushNotifications() {
  return (
    <section id="push" className="py-20 md:py-28 bg-gray-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content - Phone with notifications */}
          <div className="relative order-2 lg:order-1">
            <div className="relative max-w-sm mx-auto">
              {/* iPhone mockup */}
              <div className="relative bg-gray-800 rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-black rounded-[2.5rem] overflow-hidden">
                  {/* Lock screen */}
                  <div className="relative h-[520px] bg-gradient-to-b from-gray-800 to-gray-900">
                    {/* Time */}
                    <div className="text-center pt-16">
                      <div className="text-7xl font-light text-white">9:41</div>
                      <div className="text-lg text-gray-400 mt-1">Miércoles, 27 de noviembre</div>
                    </div>

                    {/* Notifications Stack */}
                    <div className="absolute bottom-20 left-3 right-3 space-y-2">
                      {/* Notification 3 - oldest */}
                      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/20 opacity-60 scale-95 translate-y-2">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Bell className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span className="text-xs text-gray-300 font-medium">GRUMO</span>
                              <span className="text-xs text-gray-400">hace 2h</span>
                            </div>
                            <div className="text-sm font-semibold text-white truncate">Moda Express</div>
                            <div className="text-xs text-gray-300 truncate">Nueva colección de verano</div>
                          </div>
                        </div>
                      </div>

                      {/* Notification 2 */}
                      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/20 opacity-80 scale-[0.97] translate-y-1">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Bell className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span className="text-xs text-gray-300 font-medium">GRUMO</span>
                              <span className="text-xs text-gray-400">hace 30m</span>
                            </div>
                            <div className="text-sm font-semibold text-white truncate">Delicias Gourmet</div>
                            <div className="text-xs text-gray-300 truncate">20% de descuento hoy</div>
                          </div>
                        </div>
                      </div>

                      {/* Notification 1 - newest, highlighted */}
                      <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-lg">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Bell className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span className="text-xs text-gray-200 font-medium">GRUMO</span>
                              <span className="text-xs text-gray-300">ahora</span>
                            </div>
                            <div className="text-sm font-bold text-white">Tu Tienda</div>
                            <div className="text-sm text-gray-200 mt-0.5">
                              Acabas de lanzar una oferta especial para tus clientes
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/50 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute -inset-4 bg-purple-500/20 rounded-[4rem] blur-3xl -z-10"></div>
            </div>
          </div>

          {/* Right Content */}
          <div className="space-y-8 order-1 lg:order-2">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30">
                <Bell className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Push Notifications Gratis</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                Llega directo al teléfono de tus clientes
              </h2>

              <p className="text-lg text-gray-400 leading-relaxed">
                Las páginas web se olvidan. Las apps se quedan. Cuando envías una notificación push, aparece directamente en la pantalla de tus clientes. Sin filtros de spam, sin algoritmos.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6 py-6 border-y border-gray-700">
              <div>
                <div className="text-4xl font-bold text-purple-400">90%</div>
                <div className="text-sm text-gray-500">Tasa de apertura</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-400">10x</div>
                <div className="text-sm text-gray-500">Más que email marketing</div>
              </div>
            </div>

            {/* Benefits Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="flex gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-700">
                      <Icon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{benefit.title}</div>
                      <div className="text-xs text-gray-500">{benefit.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <Link
              to="/admin"
              className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-colors"
            >
              Enviar mi primera notificación
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
