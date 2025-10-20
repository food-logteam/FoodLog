import React from 'react';

    const Footer = () => {
      return (
        <footer className="w-full py-8 px-4 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-slate-600 text-sm">
              © 2025 FoodLog. All rights reserved.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Built with ❤️ by{' '}
              <a
                rel="nofollow"
                target="_blank"
                href="https://meku.dev"
                className="text-teal-600 hover:text-teal-700 transition-colors"
              >
                Meku.dev
              </a>
            </p>
          </div>
        </footer>
      );
    };

    export default Footer;