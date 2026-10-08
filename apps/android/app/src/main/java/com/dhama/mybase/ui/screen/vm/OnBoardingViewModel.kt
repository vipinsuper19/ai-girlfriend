package com.dhama.mybase.ui.screen.vm

import android.R.attr.tag
import android.app.Activity
import android.content.Context
import android.util.Log
import android.util.Patterns
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.util.CoilUtils.result
import com.dhama.mybase.R
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.domain.UserRepo
import com.dhama.mybase.core.model.AuthState
import com.dhama.mybase.core.model.UiState
import com.dhama.mybase.core.utils.PreferencesKeys
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.firebase.FirebaseException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OnBoardingViewModel @Inject constructor(
    private val userRepo: UserRepo,
    private val dataStoreRepo: DataStoreRepo,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val tag: String = "OnBoardingViewModel"
    private val _authState = MutableStateFlow<UiState<String>>(UiState.Start)
    val authState = _authState.asStateFlow()

    private val _uiState = MutableStateFlow<AuthState>(AuthState.Initial)
    val uiState = _uiState.asStateFlow()

    fun getLoggedInStatus(): Flow<Boolean> {
        return dataStoreRepo.getBoolean(PreferencesKeys.IS_LOGGED_IN, false)
    }

    fun saveLoggedInStatus(logged: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, logged)
        }
    }

    fun getGoalStatus(): Flow<Boolean> {
        return dataStoreRepo.getBoolean(PreferencesKeys.IS_GOAL_SET, false)
    }

    fun saveGoalStatus(logged: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_GOAL_SET, logged)
        }
    }


    fun createEmailSignIn(email: String, password: String) {

        viewModelScope.launch(Dispatchers.IO) {
            try {
                _authState.value = UiState.Loading
                if (authRepository.register(email, password)) {
                    saveLoggedInStatus(true)
                    val result = "Account created successfully!"
                    _authState.value = UiState.Success(result)
                } else
                    _authState.value = UiState.Error("Sign up failed")
            } catch (e: Exception) {
                _authState.value = UiState.Error(e.message ?: "Sign up failed")
            }
        }


    }

    fun emailSignIn(email: String, password: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                _authState.value = UiState.Loading
                if (authRepository.login(email, password)) {
                    saveLoggedInStatus(true)
                    val result = "User logged in successfully!"
                    _authState.value = UiState.Success(result)
                } else
                    _authState.value = UiState.Error("Login failed")
            } catch (e: Exception) {
                _authState.value = UiState.Error(e.message ?: "Login failed")
            }
        }
    }

    fun googleSignIn(
        credentialResponse: GetCredentialResponse
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                _authState.value = UiState.Loading
                if (authRepository.signInWithGoogle(credentialResponse)) {
                    saveLoggedInStatus(true)
                    val result = "User logged in successfully!"
                    _authState.value = UiState.Success(result)
                } else
                    _authState.value = UiState.Error("Login failed")
            } catch (e: Exception) {
                if(e is kotlin.coroutines.cancellation.CancellationException) throw e

                 println("$tag login exception ${e.message}")
                _authState.value = UiState.Error(e.message ?: "Login failed")
            }
        }
    }

    fun sendOtp(phoneNumber: String, activity: Activity) {
        viewModelScope.launch {
            _uiState.value = AuthState.Loading
            authRepository.sendOtp(phoneNumber, activity, callbacks)
        }
    }

    fun signInWithOtp(verificationId: String, otp: String) {
        viewModelScope.launch {
            authRepository.signInWithOtp(verificationId, otp)
                .collect { state -> _uiState.value = state }
        }
    }

    val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {


        override fun onVerificationCompleted(credential: PhoneAuthCredential) {
            Log.d(tag, "Verification successfully implemented.")
            _uiState.value = AuthState.Success(authRepository.getCurrentUser())
        }

        override fun onVerificationFailed(e: FirebaseException) {
             Log.w(tag, "onVerificationFailed", e)
            _uiState.value = AuthState.Error(e.message ?: "Verification failed")
        }

        override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
            Log.d(tag, "onCodeSent:$verificationId")
            _uiState.value = AuthState.OtpSent(verificationId, token)
        }
    }


    fun isValidEmail(s: String) = Patterns.EMAIL_ADDRESS.matcher(s).matches()
    fun isStrongPassword(p: String): Boolean {
        // Simple example: ≥8 chars, at least one letter and one digit
        val longEnough = p.length >= 8
        val hasLetter = p.any { it.isLetter() }
        val hasDigit = p.any { it.isDigit() }
        return longEnough && hasLetter && hasDigit
    }

    fun isValidMobile(s: String) = Patterns.PHONE.matcher(s).matches()

}