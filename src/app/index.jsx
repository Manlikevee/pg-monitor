import {Redirect} from 'expo-router';import {useApp} from '../state/AppContext';
export default function Index(){const {data,ready,sessionActive}=useApp();if(!ready)return null;if(!data.onboarded)return <Redirect href="/onboarding"/>;if(!data.session&&!sessionActive)return <Redirect href="/auth"/>;return <Redirect href="/(tabs)"/>}
