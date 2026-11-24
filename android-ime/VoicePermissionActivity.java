package io.kurdikebord.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Toast;

/** User-initiated permission request from the IME. Never starts recording itself. */
public class VoicePermissionActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED) { finish(); return; }
        if(state==null) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 71);
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==71) {
            boolean granted=results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED;
            Toast.makeText(this,granted?"مۆڵەت درا؛ دووبارە دوگمەی مایک دابگرە.":"مۆڵەتی مایک نەدرا؛ لە ڕێکخستنەکان دەتوانیت چالاکی بکەیت.",Toast.LENGTH_LONG).show();
            finish();
        }
    }
}
