package com.example.shop.ui;

import com.example.shop.App;
import com.example.shop.AppState;
import com.example.shop.util.Dialogs;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.VBox;

public class LoginView {
    private final App app;
    public LoginView(App app){this.app=app;}

    public Node get(){
        VBox root = new VBox(12);
        root.setPadding(new Insets(20));
        Label title = new Label("Welcome");
        title.setStyle("-fx-font-size: 24px; -fx-font-weight: bold;");

        GridPane form = new GridPane();
        form.setHgap(10); form.setVgap(10);

        TextField name = new TextField(); name.setPromptText("Your name");
        TextField email = new TextField(); email.setPromptText("name@example.com");
        PasswordField pwd = new PasswordField(); pwd.setPromptText("6+ characters");

        form.addRow(0, new Label("Name:"), name);
        form.addRow(1, new Label("Email:"), email);
        form.addRow(2, new Label("Password:"), pwd);

        Button btn = new Button("Login / Register");
        btn.setOnAction(e -> {
            try{
                if (!email.getText().matches("[^@]+@[^@]+\\.[^@]+")) {
                    Dialogs.error("Invalid Email", "Please enter a valid email (e.g., name@example.com).");
                    return;
                }
                if (pwd.getText().length()<6) {
                    Dialogs.error("Weak Password", "Password must be at least 6 characters.");
                    return;
                }
                AppState.get().login(email.getText(), name.getText().isBlank()? email.getText().split("@")[0] : name.getText());
                app.setCenter(new CatalogView(app).get());
            }catch (Exception ex){
                Dialogs.error("Login Failed", ex.getMessage());
            }
        });

        root.getChildren().addAll(title, form, btn);
        root.setAlignment(Pos.TOP_LEFT);
        return root;
    }

}
