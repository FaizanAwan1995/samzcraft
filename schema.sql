PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT 'Accessories',price INTEGER CHECK(price IS NULL OR price BETWEEN 100 AND 1000000),stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','showcase','active','archived')),image TEXT,source TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,data BLOB NOT NULL,mime TEXT NOT NULL DEFAULT 'image/jpeg');
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT OR IGNORE INTO settings VALUES('whatsapp',''),('messenger','61593502286226'),('announcement','Small stitches. A whole lot of love.'),('story','A little yarn, a little patience, and a whole lot of heart. Samz Crafts is a family-run crochet studio in Adelaide, creating thoughtful pieces to brighten everyday life.'),('checkout_enabled','false');
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',fulfilment TEXT NOT NULL,address TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',total INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN('new','confirmed','making','ready','completed','cancelled')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(order_id TEXT NOT NULL REFERENCES orders(id),product_id TEXT NOT NULL REFERENCES products(id),title TEXT NOT NULL,price INTEGER NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),PRIMARY KEY(order_id,product_id));
CREATE TRIGGER IF NOT EXISTS check_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND status='active' AND stock>=NEW.quantity AND price=NEW.price) THEN RAISE(ABORT,'Item unavailable or price changed') END;
END;
CREATE TRIGGER IF NOT EXISTS reserve_stock AFTER INSERT ON order_items BEGIN
 UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.product_id;
 UPDATE orders SET total=total+NEW.price*NEW.quantity WHERE id=NEW.order_id;
END;
CREATE TRIGGER IF NOT EXISTS restore_cancelled_stock AFTER UPDATE OF status ON orders WHEN NEW.status='cancelled' AND OLD.status!='cancelled' BEGIN
 UPDATE products SET stock=stock+COALESCE((SELECT quantity FROM order_items WHERE order_id=NEW.id AND product_id=products.id),0) WHERE id IN(SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS cancellation_final BEFORE UPDATE OF status ON orders WHEN OLD.status='cancelled' AND NEW.status!='cancelled' BEGIN SELECT RAISE(ABORT,'Cancelled orders cannot be reopened; create a new order'); END;
CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,ref TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status,created_at);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,email TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS quote_requests(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- Retain an unenhanced, web-resolution source for prepared listing photos.
CREATE TABLE IF NOT EXISTS image_sources(image_id TEXT PRIMARY KEY REFERENCES images(id),original_id TEXT NOT NULL REFERENCES images(id));
