-- Seed inicial de menú
INSERT INTO public.menu_items (restaurant_id, name, category, description, ingredients, price, is_available, spicy_level, umami, pairing_notes)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rollo Dragón', 'roll', 'Tempura de camarón con aguacate y salsa unagi', 'camarón, aguacate, unagi', 169.00, TRUE, 1, 2, 'Armoniza con cerveza lager ligera o sake junmai'),
  ('00000000-0000-0000-0000-000000000001', 'Rollo IKU Especial', 'roll', 'Queso crema, salmón y topping de masago', 'salmón, queso crema, masago', 189.00, TRUE, 0, 2, 'Ideal con vino blanco seco y notas cítricas'),
  ('00000000-0000-0000-0000-000000000001', 'Nigiri de Salmón', 'nigiri', 'Salmón fresco sobre arroz avinagrado', 'salmón', 95.00, TRUE, 0, 2, 'Combina con sake ginjo frío'),
  ('00000000-0000-0000-0000-000000000001', 'Nigiri de Atún', 'nigiri', 'Atún rojo con shari de casa', 'atún', 99.00, TRUE, 0, 3, 'Acompaña con té verde suave o cerveza pilsner'),
  ('00000000-0000-0000-0000-000000000001', 'Sashimi de Salmón', 'sashimi', 'Cortes finos de salmón', 'salmón', 159.00, TRUE, 0, 2, 'Excelente con vino espumoso brut'),
  ('00000000-0000-0000-0000-000000000001', 'Edamame', 'entrada', 'Vainas de soya al vapor con sal', 'soya', 69.00, TRUE, 0, 1, 'Perfecto con cerveza lager'),
  ('00000000-0000-0000-0000-000000000001', 'Gyozas de Cerdo', 'entrada', 'Dumplings dorados con salsa ponzu', 'cerdo, harina', 99.00, TRUE, 0, 2, 'Mejora con vino tinto joven y fresco'),
  ('00000000-0000-0000-0000-000000000001', 'Té Verde', 'bebida', 'Infusión japonesa', 'té', 39.00, TRUE, 0, 0, 'Limpia paladar entre bocados'),
  ('00000000-0000-0000-0000-000000000001', 'Sake Junmai', 'bebida', 'Sake tradicional, perfil seco', 'arroz', 129.00, TRUE, 0, 1, 'Resalta sabores umami del pescado'),
  ('00000000-0000-0000-0000-000000000001', 'Helado de Té Matcha', 'postre', 'Helado cremoso de matcha', 'lácteos, matcha', 79.00, TRUE, 0, 1, 'Termina con notas herbales suaves');