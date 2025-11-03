package com.example.shop;

import com.example.shop.model.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

public class AppState {
    private static final AppState INSTANCE = new AppState();
    public static AppState get() { return INSTANCE; }

    private User currentUser;
    private final List<Product> products = new ArrayList<>();
    private final Map<String, CartItem> cart = new LinkedHashMap<>();
    private final List<Order> orders = new ArrayList<>();
    private final AtomicInteger orderSeq = new AtomicInteger(1);
    private final AtomicInteger receiptSeq = new AtomicInteger(1);

    private AppState() {
        // ……你原来的种子数据……
        products.add(new Product("P1001","Apples 1kg","Fruit",4.20,25,"Crisp red apples"));
        products.add(new Product("P1002","Bread Loaf","Bakery",3.00,30,"Wholegrain bread loaf"));
        products.add(new Product("P1003","Chicken Breast 1kg","Meat",9.50,15,"Lean chicken breast"));
        products.add(new Product("P1004","Chocolate Bar","Snacks",2.00,60,"Milk chocolate bar"));
        products.add(new Product("P1005","Eggs (12 pack)","Dairy",6.00,20,"Free-range eggs"));
        products.add(new Product("P1006","Milk 1L","Dairy",2.50,40,"Fresh milk"));
        products.add(new Product("P2001","Bananas 1kg","Fruit",3.20,30,"Fresh bananas"));
        products.add(new Product("P2002","Oranges 1kg","Fruit",4.80,22,"Juicy navel oranges"));
        products.add(new Product("P2003","Strawberries 500g","Fruit",5.50,18,"Sweet strawberries"));
        products.add(new Product("P2004","Croissant (4 pack)","Bakery",4.20,24,"Buttery flaky croissants"));
        products.add(new Product("P2005","Wholemeal Bread 700g","Bakery",3.40,26,"High-fiber wholemeal loaf"));
        products.add(new Product("P2006","Chocolate Muffins (4 pack)","Bakery",4.80,20,"Soft chocolate muffins"));
        products.add(new Product("P2007","Beef Mince 1kg","Meat",12.90,15,"Lean beef mince"));
        products.add(new Product("P2008","Pork Chops 1kg","Meat",11.50,14,"Fresh pork chops"));
        products.add(new Product("P2009","Salmon Fillets 500g","Meat",13.80,12,"Skin-on salmon fillets"));
        products.add(new Product("P2010","Potato Chips 200g","Snacks",2.80,40,"Salted potato chips"));
        products.add(new Product("P2011","Mixed Nuts 300g","Snacks",6.90,28,"Roasted nut mix"));
        products.add(new Product("P2012","Greek Yogurt 1kg","Dairy",6.50,16,"Plain Greek yogurt"));
        products.add(new Product("P2013","Cheddar Cheese 500g","Dairy",7.40,18,"Mature cheddar block"));
        products.add(new Product("P2014","Butter 250g","Dairy",3.60,30,"Creamy salted butter"));
        products.add(new Product("P2015","Orange Juice 2L","Drinks",5.80,25,"No added sugar"));
        products.add(new Product("P2016","Cola 1.25L","Drinks",2.50,40,"Carbonated soft drink"));
        products.add(new Product("P2017","Green Tea 1L","Drinks",3.20,22,"Unsweetened green tea"));
        products.add(new Product("P2018","Rice 5kg","Grains",12.90,14,"Long-grain white rice"));
        products.add(new Product("P2019","Pasta 1kg","Grains",2.40,32,"Durum wheat spaghetti"));
        products.add(new Product("P2020","Oats 1kg","Grains",3.10,26,"Rolled oats for breakfast"));
    }

    public void login(String email, String name) {
        this.currentUser = new User(UUID.randomUUID().toString(), name, email);
    }
    public void logout() { currentUser = null; cart.clear(); }
    public User getCurrentUser() { return currentUser; }

    public List<Product> listProducts(String category) {
        return products.stream()
                .filter(Product::isActive)
                .filter(p -> category==null || "All".equals(category) || p.getCategory().equals(category))
                .collect(Collectors.toList());
    }
    public Set<String> categories() {
        Set<String> c = new LinkedHashSet<>();
        c.add("All");
        products.forEach(p -> { if (p.isActive()) c.add(p.getCategory()); });
        return c;
    }

    public List<CartItem> getCartItems() { return new ArrayList<>(cart.values()); }
    public void addToCart(Product p, int qty) {
        if (!p.isActive()) throw new IllegalStateException("Product is inactive.");
        if (qty<=0) throw new IllegalArgumentException("Quantity must be positive.");
        if (qty>p.getStock()) throw new IllegalArgumentException("Only "+p.getStock()+" left in stock.");
        CartItem existing = cart.get(p.getId());
        int newQty = (existing==null?0:existing.getQty()) + qty;
        if (newQty>p.getStock()) throw new IllegalArgumentException("Only "+p.getStock()+" left in stock.");
        cart.put(p.getId(), new CartItem(p.getId(), p.getName(), p.getPrice(), newQty));
    }
    public void updateQty(String productId, int qty) {
        CartItem item = cart.get(productId);
        if (item==null) return;
        Product p = findProductById(productId);
        if (qty<=0) { cart.remove(productId); return; }
        if (qty>p.getStock()) throw new IllegalArgumentException("Only "+p.getStock()+" left in stock.");
        item.setQty(qty);
    }
    public double cartTotal() {
        return cart.values().stream().mapToDouble(i->i.getUnitPrice()*i.getQty()).sum();
    }
    public void clearCart() { cart.clear(); }

    public Order checkout(String line1, String city, String postCode) {
        if (currentUser==null) throw new IllegalStateException("Please login.");
        if (cart.isEmpty()) throw new IllegalStateException("Cart is empty.");
        if (line1.isBlank() || city.isBlank() || !postCode.matches("\\d{4}"))
            throw new IllegalArgumentException("Invalid address. Post code must be 4 digits.");
        for (CartItem i : cart.values()) {
            Product p = findProductById(i.getProductId());
            if (i.getQty()>p.getStock()) throw new IllegalStateException("Stock changed. Only "+p.getStock()+" left.");
            p.setStock(p.getStock()-i.getQty());
        }
        String id = String.valueOf(orderSeq.getAndIncrement());
        List<OrderItem> snapshot = cart.values().stream()
                .map(i -> new OrderItem(i.getProductId(), i.getName(), i.getUnitPrice(), i.getQty()))
                .collect(Collectors.toList());
        double total = cartTotal();
        Order o = new Order(id, currentUser.getId(), snapshot, line1, city, postCode, total, "PENDING",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        orders.add(o);
        cart.clear();
        return o;
    }
    public List<Order> listOrders() { return orders; }
    public void cancelOrder(Order o) {
        if (!o.getStatus().equals("PENDING")) throw new IllegalStateException("Only pending orders can be cancelled.");
        o.setStatus("CANCELLED");
    }
    public Receipt pay(Order o, double amount) {
        if (!o.getStatus().equals("PENDING")) throw new IllegalStateException("Order not payable.");
        if (Math.abs(amount - o.getTotal()) > 1e-6) throw new IllegalArgumentException("Payment amount must match the order total.");
        o.setStatus("PAID");
        String rid = "R-" + receiptSeq.getAndIncrement();
        String issuedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        Receipt r = new Receipt(rid, o.getId(), amount, issuedAt,
                "Receipt " + rid + "\nOrder: " + o.getId() + "\nAmount: $" + String.format("%.2f", amount) + "\nDate: " + issuedAt);
        o.setReceipt(r);
        return r;
    }

    public List<Product> listAllProducts() {
        return new ArrayList<>(products);
    }
    public Product findProductById(String id) {
        return products.stream().filter(p -> p.getId().equals(id)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("Product not found: "+id));
    }
    public void createProduct(String id, String name, String category, double price, int stock, String desc, boolean active) {
        if (id==null || id.isBlank()) throw new IllegalArgumentException("ID required");
        if (products.stream().anyMatch(p->p.getId().equals(id))) throw new IllegalArgumentException("ID already exists");
        validateProductFields(name, category, price, stock);
        Product p = new Product(id, name, category, price, stock, desc==null?"":desc);
        p.setActive(active);
        products.add(p);
    }
    public void updateProduct(String id, String name, String category, double price, int stock, String desc, boolean active) {
        Product p = findProductById(id);
        validateProductFields(name, category, price, stock);
        products.remove(p);
        Product np = new Product(id, name, category, price, stock, desc==null?"":desc);
        np.setActive(active);
        products.add(np);
    }
    public void deleteProduct(String id) {
        Product p = findProductById(id);
        products.remove(p);
        cart.remove(id);
    }
    public void toggleActive(String id, boolean active) {
        findProductById(id).setActive(active);
    }
    public void adjustStock(String id, int delta) {
        Product p = findProductById(id);
        int ns = p.getStock() + delta;
        if (ns < 0) throw new IllegalArgumentException("Stock cannot be negative");
        p.setStock(ns);
    }
    private void validateProductFields(String name, String category, double price, int stock) {
        if (name==null || name.isBlank()) throw new IllegalArgumentException("Name required");
        if (category==null || category.isBlank()) throw new IllegalArgumentException("Category required");
        if (price <= 0) throw new IllegalArgumentException("Price must be > 0");
        if (stock < 0) throw new IllegalArgumentException("Stock must be >= 0");
    }
}


