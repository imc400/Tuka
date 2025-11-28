import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-purple-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
          Tu tienda merece estar en una app
        </h2>
        <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
          Más de 100 emprendedores ya conectaron su tienda Shopify a Grumo. Únete gratis y lleva tu negocio al siguiente nivel.
        </p>

        {/* Quick benefits */}
        <div className="flex flex-wrap justify-center gap-6 mb-10">
          <div className="flex items-center gap-2 text-white">
            <Check className="w-5 h-5 text-green-300" />
            <span>100% Gratis</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Check className="w-5 h-5 text-green-300" />
            <span>Sin comisiones</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Check className="w-5 h-5 text-green-300" />
            <span>Push ilimitados</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Check className="w-5 h-5 text-green-300" />
            <span>5 min setup</span>
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/admin"
          className="inline-flex items-center justify-center px-10 py-5 bg-white text-purple-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
        >
          Conectar mi tienda Shopify
          <ArrowRight className="w-5 h-5 ml-2" />
        </Link>

        <p className="text-purple-200 text-sm mt-4">
          Sin tarjeta de crédito requerida
        </p>
      </div>
    </section>
  );
}
