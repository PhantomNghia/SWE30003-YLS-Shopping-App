package com.example.shop.ui;

import com.example.shop.App;
import com.example.shop.AppState;
import com.example.shop.model.Order;
import com.example.shop.model.OrderItem;
import com.example.shop.model.Receipt;
import com.example.shop.util.Dialogs;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.*;

public class OrderHistoryView {
    private final App app;
    public OrderHistoryView(App app){this.app=app;}

    public Node get(){
        VBox root = new VBox(10);
        root.setPadding(new Insets(10));
        Label title = new Label("Order History");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold;");

        GridPane table = new GridPane();
        table.setHgap(10); table.setVgap(6);
        table.addRow(0, bold("Order ID"), bold("Date"), bold("Amount"), bold("Status"), bold("Actions"));

        int row=1;
        var orders = AppState.get().listOrders();
        for (Order o: orders){
            Button view = new Button("View Receipt");
            Button cancel = new Button("Cancel Order");
            Button pay = new Button("Pay");

            view.setOnAction(e -> {
                if (o.getReceipt()==null) {
                    Dialogs.info("No Receipt","This order has no receipt yet.");
                } else {
                    Dialogs.info("Receipt " + o.getReceipt().getId(), o.getReceipt().getText());
                }
            });

            cancel.setOnAction(e -> {
                try{
                    if (Dialogs.confirm("Cancel", "Cancel order "+o.getId()+" ?")) {
                        AppState.get().cancelOrder(o);
                        app.setCenter(new OrderHistoryView(app).get());
                    }
                }catch (Exception ex){ Dialogs.error("Cannot Cancel", ex.getMessage()); }
            });

            pay.setOnAction(e -> {
                var inp = Dialogs.prompt("Pay", "Enter amount (must equal total $" + String.format("%.2f", o.getTotal()) + ")", String.format("%.2f", o.getTotal()));
                inp.ifPresent(v -> {
                    try{
                        double amt = Double.parseDouble(v);
                        Receipt r = AppState.get().pay(o, amt);
                        Dialogs.info("Paid", r.getText());
                        app.setCenter(new OrderHistoryView(app).get());
                    }catch (NumberFormatException ex){ Dialogs.error("Invalid Amount","Please enter a valid number."); }
                    catch (Exception ex){ Dialogs.error("Payment Failed", ex.getMessage()); }
                });
            });

            HBox ops = new HBox(6);
            if ("PENDING".equals(o.getStatus())) {
                ops.getChildren().addAll(pay, new Separator(), cancel, view);
            } else {
                ops.getChildren().addAll(view);
            }

            table.addRow(row,
                    new Label(o.getId()),
                    new Label(o.getCreatedAt()),
                    new Label(String.format("$%.2f", o.getTotal())),
                    new Label(o.getStatus()),
                    ops);
            row++;

            // 订单项小表（可选，便于评分看到快照）
            VBox itemsBox = new VBox(2);
            for (OrderItem it: o.getItems()) {
                itemsBox.getChildren().add(new Label(" - " + it.getName() + " x" + it.getQty()
                        + " ($" + String.format("%.2f", it.getUnitPrice()) + ")"));
            }
            table.add(itemsBox, 1, row, 4,1);
            row++;
        }

        root.getChildren().addAll(title, new Separator(), table);
        return root;
    }

    private Label bold(String s){ Label l=new Label(s); l.setStyle("-fx-font-weight: bold;"); return l; }
}

