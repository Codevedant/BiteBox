CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Confirmed'
    CHECK (status IN ('Confirmed', 'Preparing', 'On the way', 'Delivered')),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  delivery_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

INSERT INTO menu_items (name, description, category, price, image_url, badge, is_vegetarian)
SELECT seed.name, seed.description, seed.category, seed.price, seed.image_url, seed.badge, seed.is_vegetarian
FROM (VALUES
  ('Smash House Burger', 'Double seared patties, aged cheddar, house sauce, soft potato bun.', 'Burgers', 329.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85', 'Bestseller', FALSE),
  ('Truffle Mushroom Pizza', 'Wild mushrooms, mozzarella, truffle cream and fresh herbs.', 'Pizza', 389.00, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85', 'Chef pick', TRUE),
  ('Crispy Chicken Bao', 'Two fluffy bao, crunchy chicken, pickled cucumber and chilli jam.', 'Asian', 279.00, 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=85', 'Popular', FALSE),
  ('Green Goddess Bowl', 'Avocado, edamame, greens, quinoa and bright herb dressing.', 'Healthy', 319.00, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85', 'Fresh', TRUE),
  ('Creamy Pesto Pasta', 'Al dente penne tossed in basil pesto, parmesan and toasted pine nuts.', 'Pasta', 299.00, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85', '', TRUE),
  ('Loaded Truffle Fries', 'Golden fries, parmesan snow, truffle mayo and chives.', 'Sides', 179.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85', 'Fan fave', TRUE)
) AS seed(name, description, category, price, image_url, badge, is_vegetarian)
WHERE NOT EXISTS (SELECT 1 FROM menu_items LIMIT 1);
