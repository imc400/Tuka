import { Instagram, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <img
                src="/grumo-logo-horizontal.png"
                alt="Grumo"
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-gray-500 mb-5 max-w-sm text-sm leading-relaxed">
              La app que le da superpoderes a tu tienda Shopify. Gratis, sin comisiones, sin mensualidades.
            </p>
            <div className="flex gap-3">
              <a
                href="https://instagram.com/grumo.app"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="mailto:hola@grumo.app"
                className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h3 className="text-white font-medium mb-4 text-sm">Producto</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#beneficios" className="hover:text-white transition-colors">
                  Beneficios
                </a>
              </li>
              <li>
                <a href="#push" className="hover:text-white transition-colors">
                  Push Notifications
                </a>
              </li>
              <li>
                <a href="#como-funciona" className="hover:text-white transition-colors">
                  Cómo Funciona
                </a>
              </li>
              <li>
                <a href="#precios" className="hover:text-white transition-colors">
                  Precios
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h3 className="text-white font-medium mb-4 text-sm">Recursos</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <a href="mailto:hola@grumo.app" className="hover:text-white transition-colors">
                  Contacto
                </a>
              </li>
              <li>
                <a href="#ayuda" className="hover:text-white transition-colors">
                  Centro de Ayuda
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="#terminos" className="hover:text-white transition-colors">
                Términos y Condiciones
              </a>
              <span className="text-gray-700">|</span>
              <a href="#privacidad" className="hover:text-white transition-colors">
                Política de Privacidad
              </a>
            </div>

            <div className="text-sm text-gray-500">
              <p>© {currentYear} Grumo. Hecho en Chile.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
