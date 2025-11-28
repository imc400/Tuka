import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  'Tu tienda visible en la app Grumo',
  'Notificaciones push ilimitadas',
  'Dashboard completo de analytics',
  'Sincronización automática con Shopify',
  'Soporte por email',
  'Sin límite de productos',
  'Sin límite de ventas',
  'Pagos directos a tu Mercado Pago',
];

export default function Pricing() {
  return (
    <section id="precios" className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-purple-100 border border-purple-200 rounded-full mb-4">
            <span className="text-sm font-semibold text-purple-700">
              Beta
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            100% Gratis durante el Beta
          </h2>
          <p className="text-lg text-gray-600">
            Mientras estamos en Beta, no cobramos comisiones por venta, mensualidades, ni costos de setup. Aprovecha esta etapa para hacer crecer tu negocio sin costo.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-purple-600 px-8 py-10 text-center">
              <div className="text-purple-200 font-medium mb-2">Durante el Beta</div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold text-white">$0</span>
                <span className="text-purple-200 text-xl">/mes</span>
              </div>
              <div className="text-purple-100 mt-2">Sin tarjeta de crédito requerida</div>
            </div>

            {/* Features */}
            <div className="px-8 py-8">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Todo incluido
              </div>
              <ul className="space-y-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="px-8 pb-8">
              <Link
                to="/admin"
                className="flex items-center justify-center w-full px-6 py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors"
              >
                Conectar mi tienda gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <p className="text-center text-sm text-gray-500 mt-4">
                Configuración en menos de 5 minutos
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-gray-900">Preguntas frecuentes</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">¿De verdad es gratis?</h4>
              <p className="text-gray-600 text-sm">
                Sí, durante el Beta es 100% gratis. No cobramos comisiones por venta, ni mensualidades, ni costos de setup. Aprovecha esta etapa para hacer crecer tu negocio sin costo alguno.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">¿Quién recibe el pago de las ventas?</h4>
              <p className="text-gray-600 text-sm">
                Tú. El 100% del pago va directo a tu cuenta de Mercado Pago. Grumo no toca tu dinero en ningún momento.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">¿Necesito conocimientos técnicos?</h4>
              <p className="text-gray-600 text-sm">
                No. Solo necesitas una tienda Shopify activa. La conexión toma menos de 5 minutos y todo se sincroniza automáticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
