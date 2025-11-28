import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="#inicio" className="flex items-center">
              <img
                src="/grumo-logo-horizontal.png"
                alt="Grumo"
                className="h-10 md:h-12 w-auto object-contain"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <a href="#beneficios" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Beneficios
            </a>
            <a href="#push" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Push Notifications
            </a>
            <a href="#como-funciona" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Cómo Funciona
            </a>
            <a href="#precios" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Precios
            </a>
            <Link
              to="/admin"
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Conectar mi Tienda
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-gray-900 p-2"
              aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <a
              href="#beneficios"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Beneficios
            </a>
            <a
              href="#push"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Push Notifications
            </a>
            <a
              href="#como-funciona"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Cómo Funciona
            </a>
            <a
              href="#precios"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Precios
            </a>
            <Link
              to="/admin"
              className="block px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-center"
              onClick={() => setIsMenuOpen(false)}
            >
              Conectar mi Tienda
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
