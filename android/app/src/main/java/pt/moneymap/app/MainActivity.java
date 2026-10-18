package pt.moneymap.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lets the web app send the numbers shown on the home-screen widget.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
