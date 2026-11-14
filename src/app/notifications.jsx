import {useEffect, useState} from 'react';
import {ScrollView, Text, View, Switch, Alert, Image} from 'react-native';
import {Page, Header, Card, Field, Button, useColors} from '../components/ui';
import {useApp} from '../state/AppContext';
import {registerPushDevice} from '../services/push';
import {sendTestNotification} from '../services/notifications';

const labels = [
  ['notifications', 'All notifications'],
  ['successAlerts', 'Notify on every successful check'],
  ['failureAlerts', 'Notify on every failed check'],
  ['successRateAlerts', 'Success rate alerts'],
  ['offlineAlerts', 'Database offline alerts'],
  ['recoveryAlerts', 'Recovery alerts'],
];

export default function Notifications() {
  const {data, patch} = useApp();
  const c = useColors();
  const preferences = data.preferences;
  const [threshold, setThreshold] = useState(String(preferences.threshold));
  const [failures, setFailures] = useState(String(preferences.failuresBeforeAlert));
  const [quietStart, setQuietStart] = useState(preferences.quietStart);
  const [quietEnd, setQuietEnd] = useState(preferences.quietEnd);
  const [toast, setToast] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const update = (key, value) => patch({preferences: {...preferences, [key]: value}});
  const testNotification = async () => {
    setTesting(true);
    const sent = await sendTestNotification();
    setToast(sent
      ? 'Sample notification sent. Check your banner or notification center.'
      : 'Notifications are unavailable. Allow them in your device settings.');
    setTesting(false);
  };

  return <Page>
    <ScrollView contentContainerStyle={{paddingBottom: 30}}>
      <Header title="Notifications" subtitle="Set alert preferences"/>
      <View style={{paddingHorizontal: 16}}>
        <Card>
          {labels.map(([key, label]) => <View key={key} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9}}>
            <Text style={{color: c.text, fontWeight: '600', flex: 1, marginRight: 12}}>{label}</Text>
            <Switch value={!!preferences[key]} onValueChange={value => update(key, value)} trackColor={{true: c.green}}/>
          </View>)}
        </Card>

        <Card>
          <Text style={{fontWeight: '800', fontSize: 16, color: c.text}}>Notification tester</Text>
          <Text style={{fontSize: 13, color: c.muted, lineHeight: 19, marginTop: 7}}>
            Send a sample local notification to check that alerts are allowed on this device.
          </Text>
          <Button title={testing ? 'Sending…' : 'Send test notification'} secondary onPress={testNotification} disabled={testing}/>
        </Card>

        <Card>
          <Text style={{fontWeight: '800', fontSize: 16, color: c.text, marginBottom: 10}}>Alert thresholds</Text>
          <Field label="Consecutive failures before offline alert" value={failures} onChangeText={setFailures} keyboardType="number-pad" placeholder="2"/>
          <Field label="Success rate threshold (%)" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" placeholder="95"/>
          <View style={{flexDirection: 'row', gap: 8}}>
            {[99, 95, 90].map(value => <Text key={value} onPress={() => setThreshold(String(value))} style={{paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: threshold === String(value) ? c.green : c.bg, color: threshold === String(value) ? 'white' : c.muted}}>{value}%</Text>)}
          </View>
          <Text style={{fontWeight: '700', color: c.text, marginVertical: 12}}>Quiet hours</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex: 1}}><Field label="From" value={quietStart} onChangeText={setQuietStart} placeholder="22:00"/></View>
            <View style={{flex: 1}}><Field label="To" value={quietEnd} onChangeText={setQuietEnd} placeholder="08:00"/></View>
          </View>
          <Button title="Save preferences" onPress={() => {
            patch({preferences: {...preferences, threshold: Number(threshold) || 95, failuresBeforeAlert: Number(failures) || 2, quietStart, quietEnd}});
            Alert.alert('Saved', 'Notification preferences updated.');
          }}/>
        </Card>

        {data.backend?.url && !/\/(?:api\/)?monitor\/check\/?$/.test(data.backend.url) && <Button title="Enable backend push notifications" secondary onPress={async () => {
          try {
            await registerPushDevice(data.backend);
            Alert.alert('Push notifications enabled', 'This device is registered with your monitoring backend.');
          } catch (error) {
            Alert.alert('Could not enable push notifications', error.message);
          }
        }}/>}

        <Card>
          <Text style={{fontWeight: '800', fontSize: 16, color: c.text}}>Outage and recovery events</Text>
          {data.history.filter(event => ['offline', 'recovered'].includes(event.type)).slice(0, 8).length === 0
            ? <Text style={{color: c.muted, marginTop: 8}}>No alert events have been recorded yet.</Text>
            : data.history.filter(event => ['offline', 'recovered'].includes(event.type)).slice(0, 8).map(event => <Text key={event.id} style={{color: c.text, marginTop: 9}}>{event.type === 'offline' ? 'Database offline' : 'Database recovered'} · {event.databaseName} · {new Date(event.at).toLocaleString()}</Text>)}
        </Card>
      </View>
    </ScrollView>
    {toast ? <View pointerEvents="none" style={{position: 'absolute', left: 20, right: 20, bottom: 18, backgroundColor: c.text, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, elevation: 8, flexDirection: 'row', alignItems: 'center'}}>
      <Image source={require('../../assets/images/pg-monitor-icon.png')} style={{width: 28, height: 28, borderRadius: 7, marginRight: 10}}/>
      <Text style={{color: c.card, fontSize: 13, fontWeight: '600', flex: 1}}>{toast}</Text>
    </View> : null}
  </Page>;
}
