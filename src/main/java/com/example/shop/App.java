package com.example.shop;

import com.example.shop.ui.AdminView;
import com.example.shop.ui.CartView;
import com.example.shop.ui.CatalogView;
import com.example.shop.ui.LoginView;
import com.example.shop.ui.OrderHistoryView;
import com.example.shop.util.Dialogs;
import javafx.application.Application;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.control.ToolBar;
import javafx.scene.layout.BorderPane;
import javafx.stage.Stage;

public class App extends Application {
    private BorderPane root;
    private Label userLabel;
    private Button btnAdmin;
    private static final String ADMIN_EMAIL = "admin@local.com";

    @Override
    public void start(Stage stage) {
        root = new BorderPane();
        Scene scene = new Scene(root, 1000, 650);

        Button btnWelcome = new Button("Welcome");
        Button btnCatalog = new Button("Catalog");
        Button btnCart    = new Button("Cart");
        Button btnHistory = new Button("Order History");
        btnAdmin          = new Button("Admin");
        Button btnLogout  = new Button("Logout");
        userLabel         = new Label("Not logged in");

        ToolBar topBar = new ToolBar(
                btnWelcome, btnCatalog, btnCart, btnHistory, btnAdmin, btnLogout,
                new Separator(), userLabel
        );
        root.setTop(topBar);
        BorderPane.setMargin(topBar, new Insets(6));

        showLogin();

        btnWelcome.setOnAction(e -> showLogin());
        btnCatalog.setOnAction(e -> setCenter(new CatalogView(this).get()));
        btnCart.setOnAction(e    -> setCenter(new CartView(this).get()));
        btnHistory.setOnAction(e -> setCenter(new OrderHistoryView(this).get()));
        btnAdmin.setOnAction(e -> {
            var u = AppState.get().getCurrentUser();
            if (u != null && ADMIN_EMAIL.equalsIgnoreCase(u.getEmail())) {
                setCenter(new AdminView(this).get());
            } else {
                Dialogs.error("Forbidden", "Admin only.");
            }
        });
        btnLogout.setOnAction(e -> {
            AppState.get().logout();
            showLogin();
        });

        stage.setTitle("Shopping System");
        stage.setScene(scene);
        stage.show();
    }

    public void refreshUserLabel() {
        var u = AppState.get().getCurrentUser();
        if (u != null) {
            userLabel.setText(u.getName());
            boolean isAdminEmail = ADMIN_EMAIL.equalsIgnoreCase(u.getEmail());
            btnAdmin.setVisible(isAdminEmail);
            btnAdmin.setManaged(isAdminEmail);
        } else {
            userLabel.setText("Not logged in");
            btnAdmin.setVisible(false);
            btnAdmin.setManaged(false);
        }
    }

    public void setCenter(javafx.scene.Node node) {
        root.setCenter(node);
        BorderPane.setMargin(node, new Insets(10));
        refreshUserLabel();
    }

    public void showLogin() {
        setCenter(new LoginView(this).get());
    }

    public static void main(String[] args) {
        launch(args);
    }
}

