package com.example.shop.ui;

import com.example.shop.App;
import com.example.shop.AppState;
import com.example.shop.model.CartItem;
import com.example.shop.model.Order;
import com.example.shop.util.Dialogs;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.*;

import java.util.List;

public class CartView {
    private final App app;
    public CartView(App app){this.app=app;}

    public Node get(){
        VBox root = new VBox(10);
        root.setPadding(new Insets(10));
        Label title = new Label("Shopping Cart");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold;");

        VBox listBox = new VBox(6);
        refreshList(listBox);

        TextField line1 = new TextField(); line1.setPromptText("Street / Line 1");
        TextField city = new TextField();  city.setPromptText("City");
        TextField post = new TextField();  post.setPromptText("Post Code (4 digits)");
        HBox addr = new HBox(8, line1, city, post); addr.setAlignment(Pos.CENTER_LEFT);

        Label total = new Label();
        total.setStyle("-fx-font-weight: bold;");
        Runnable refreshTotal = () -> total.setText(String.format("Total: $%.2f", AppState.get().cartTotal()));
        refreshTotal.run();

        Button checkout = new Button("Checkout");
        checkout.setOnAction(e -> {
            try{
                Order o = AppState.get().checkout(line1.getText(), city.getText(), post.getText());
                Dialogs.info("Order Created",
                        "Order "+o.getId()+" created.\nAddress: "+o.getAddress()+"\nTotal: $"+String.format("%.2f", o.getTotal()));
                app.setCenter(new OrderHistoryView(app).get());
            }catch(Exception ex){
                Dialogs.error("Checkout Failed", ex.getMessage());
            }
        });

        root.getChildren().addAll(title, new Separator(), listBox, new Separator(), addr,
                new HBox(12, total, checkout));
        return root;
    }

    private void refreshList(VBox listBox){
        listBox.getChildren().clear();
        List<CartItem> items = AppState.get().getCartItems();
        if (items.isEmpty()) {
            listBox.getChildren().add(new Label("Your cart is empty"));
            return;
        }
        for (CartItem it: items){
            TextField qty = new TextField(String.valueOf(it.getQty()));
            qty.setPrefWidth(60);
            Button update = new Button("Update");
            Button remove = new Button("Remove");
            update.setOnAction(e -> {
                try{
                    int q = Integer.parseInt(qty.getText());
                    AppState.get().updateQty(it.getProductId(), q);
                    refreshList(listBox);
                }catch (NumberFormatException ex){
                    Dialogs.error("Invalid Quantity","Quantity must be an integer.");
                }catch (Exception ex){
                    Dialogs.error("Update Failed", ex.getMessage());
                }
            });
            remove.setOnAction(e -> {
                AppState.get().updateQty(it.getProductId(), 0);
                refreshList(listBox);
            });
            HBox row = new HBox(10,
                    new Label(it.getName()),
                    new Label(String.format("$%.2f", it.getUnitPrice())),
                    new Label("x"), qty,
                    new Label(String.format("= $%.2f", it.getSubTotal())),
                    update, remove);
            row.setAlignment(Pos.CENTER_LEFT);
            row.setPadding(new Insets(2,0,2,0));
            listBox.getChildren().add(row);
        }
        listBox.getChildren().add(new Label(String.format("Total: $%.2f", AppState.get().cartTotal())));
    }
}
