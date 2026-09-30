package com.dhama.mybase.core.data

import android.app.Activity
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.model.AuthState
import com.dhama.mybase.core.network.ApiClient
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.Firebase
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class AuthRepoImpl(
    private val api: ApiClient,
) : AuthRepository {

    private val tag = "AuthRepository"
    private val auth = Firebase.auth
    override fun isLoggedIn(): Boolean {
        return auth.currentUser != null
    }

    override fun getCurrentUser(): FirebaseUser? {
        return auth.currentUser
    }

    override suspend fun register(email: String, password: String): Boolean {
        try {
            val result = suspendCoroutine { continuation ->
                Firebase.auth
                    .createUserWithEmailAndPassword(email,password)
                    .addOnSuccessListener {
                        println("$tag register successful.")
                        CoroutineScope(Dispatchers.IO).launch {
                            continuation.resume(login(email,password))
                        }
                    }
                    .addOnFailureListener {
                        println("$tag Login failed: ${it.message}")
                        continuation.resume(false)
                    }
            }

            return result

        } catch (e: Exception) {
           e.printStackTrace()
            if(e is CancellationException) throw e
            println(tag + "register exception ${e.message}")
            return false
        }
    }

   override suspend fun login(email: String, password: String) : Boolean{
       try {
           val result = suspendCoroutine { continuation ->
               Firebase.auth
                   .signInWithEmailAndPassword(email,password)
                   .addOnSuccessListener { task ->
                       println("$tag Login successful.")
                       continuation.resume(true)
                   }
                   .addOnFailureListener {
                       println("$tag Login failed: ${it.message}")
                       continuation.resume(false)
                   }
           }

           if (result) {
               try {
                   api.establish(email, password)
               } catch (error: CancellationException) {
                   throw error
               } catch (_: Exception) {
                   // Email sign-in still stands. Chat stays on this phone until the API accepts the session.
               }
           }
           return result

       } catch (e: Exception) {
           e.printStackTrace()
           if(e is CancellationException) throw e
           println(tag + "login exception ${e.message}")
           return false
       }
    }


    override suspend fun signInWithGoogle(result: GetCredentialResponse): Boolean {
        if(isLoggedIn())
            return true
        try {

            //val result = buildCredentialRequest()
            return handleSignIn(result)

        }catch (e : Exception){
            e.printStackTrace()
            if(e is kotlin.coroutines.cancellation.CancellationException) throw e

            println("$tag login exception ${e.message}")
            return false
        }
    }


    private suspend fun handleSignIn(result: GetCredentialResponse): Boolean{
        val credential = result.credential
        if(
            credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ){

            try {

                val tokenCredential = GoogleIdTokenCredential.createFrom(credential.data)

                println(tag+ "name ${tokenCredential.displayName}")
                println(tag+ "email ${tokenCredential.id}")

                val authCredential = GoogleAuthProvider.getCredential(tokenCredential.idToken,null)
                val authResult = auth.signInWithCredential(authCredential).await()

                if (authResult.user != null) {
                    api.clear()
                    return true
                }
                return false



            }catch (e: GoogleIdTokenParsingException){
                e.printStackTrace()
                println(tag + "GoogleIdTokenParsingException ${e.message}")
                return false
            }

        }else{
            println(tag + "Credential type not supported")
            return false
        }

    }


    override suspend fun sendOtp(phoneNumber: String, activity: Activity,
                                 callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks) {

        val options = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(phoneNumber)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(callbacks)
            .build()

        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    override suspend fun signInWithOtp(verificationId: String, otp: String): Flow<AuthState> = flow {
        emit(AuthState.Loading)
        try {
            val credential = PhoneAuthProvider.getCredential(verificationId, otp)
            val result = auth.signInWithCredential(credential).await()
            api.clear()
            emit(AuthState.Success(result.user))
        } catch (e: Exception) {
            emit(AuthState.Error(e.message ?: "Verification failed"))
        }
    }

    override suspend fun logout(){
//        credentialManager.clearCredentialState(
//            ClearCredentialStateRequest()
//        )
        api.clear()
        auth.signOut()
    }

}