import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {lazyLoad} from '../utils/lazyLoading';

// Lazy load auth screens
const LoginScreen = lazyLoad(() => import('../screens/auth/LoginScreen'));
const SignUpScreen = lazyLoad(() => import('../screens/auth/SignUpScreen'));

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

