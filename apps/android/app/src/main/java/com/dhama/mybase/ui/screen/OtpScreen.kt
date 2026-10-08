package com.dhama.mybase.ui.screen

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.withLink
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dhama.mybase.ui.component.MyButton
import com.dhama.mybase.ui.theme.MyBaseTheme
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.milliseconds

@Composable
fun OtpScreen(onNavigateToHome:()->Unit,onNavigateToLogin: () -> Unit) {
    var counter by  remember {
        mutableIntStateOf(30)
    }

    LaunchedEffect(key1 = counter){
        while (counter > 0) {
            delay(1000L.milliseconds)
            counter--
        }
    }
    val listColors = listOf(MaterialTheme.colorScheme.secondaryContainer, Color.White)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(colors = listColors))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        //AppLogo()
        Spacer(modifier = Modifier.height(40.dp))
        Text(
            text = "Verify Phone Number",
            style = MaterialTheme.typography.displayMedium
        )
        Spacer(modifier = Modifier.height(10.dp))
        ChangeNumberText(onNavigateToLogin = {
            onNavigateToLogin()
        })
        Spacer(modifier = Modifier.height(40.dp))
        Row(
            Modifier
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
        ) {
            OutlinedTextField(
                value = "",
                singleLine = true,
                shape = MaterialTheme.shapes.extraSmall,
                onValueChange = {it},
                keyboardOptions = KeyboardOptions.Default.copy(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { }
                ),
                modifier = Modifier.width(50.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            OutlinedTextField(
                value = "",
                singleLine = true,
                shape = MaterialTheme.shapes.extraSmall,
                onValueChange = {it},
                keyboardOptions = KeyboardOptions.Default.copy(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { }
                ),
                modifier = Modifier.width(50.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))
            OutlinedTextField(
                value = "",
                singleLine = true,
                shape = MaterialTheme.shapes.extraSmall,
                onValueChange = {it},
                keyboardOptions = KeyboardOptions.Default.copy(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { }
                ),
                modifier = Modifier.width(50.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))
            OutlinedTextField(
                value = "",
                singleLine = true,
                shape = MaterialTheme.shapes.extraSmall,
                onValueChange = {it},
                keyboardOptions = KeyboardOptions.Default.copy(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { }
                ),
                modifier = Modifier.width(50.dp)
            )
        }
        Spacer(modifier = Modifier.height(40.dp))
        MyButton(
            loading = false,
            text = "Verify",
            textLoading = "Signing up..."
        ) {
            onNavigateToHome()
        }
        Spacer(modifier = Modifier.height(10.dp))
        ResendOtpText(counter)
    }
}

@Composable
fun ChangeNumberText(onNavigateToLogin: () -> Unit) {
    val annotatedText = buildAnnotatedString {
        val grayStyle = SpanStyle(
            color = MaterialTheme.colorScheme.secondary,
            fontSize = 12.sp,
            fontFamily = FontFamily.SansSerif
        )
        val style = SpanStyle(
            color = MaterialTheme.colorScheme.primary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.SansSerif
        )

        withStyle(grayStyle) {
            append("We have sent an OTP to your mobile number. ")
        }
        
        val link = LinkAnnotation.Clickable(
            tag = "Change",
            styles = TextLinkStyles(style = style)
        ) {
            onNavigateToLogin()
            Log.d("Text_Clicked", "Change:text ")
        }
        withLink(link) {
            append("Change")
        }
    }

    Text(text = annotatedText)
}

@Composable
fun ResendOtpText(counter: Int) {

    val grayStyle = SpanStyle(
        color = MaterialTheme.colorScheme.secondary,
        fontSize = 12.sp,
        fontFamily = FontFamily.SansSerif
    )
    val style = SpanStyle(
        color = MaterialTheme.colorScheme.primary,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.SansSerif
    )

    val annotatedText = buildAnnotatedString {

        withStyle(grayStyle) {
            if (counter > 0)
                append("Did not get it? Resend OTP in ")
            else
                append("Did not get it? ")
        }
        if (counter == 0) {
            val link = LinkAnnotation.Clickable(
                tag = "Send again",
                styles = TextLinkStyles(style = style)
            ) {
                Log.d("Text_Clicked", "Send again:text ")
            }
            withLink(link) {
                append("Send again")
            }
        } else {
            withStyle(style) {
                append("$counter")
            }
            withStyle(grayStyle) {
                append(" sec")
            }
        }
    }

    Text(text = annotatedText)
}

@Preview(showBackground = true)
@Composable
fun ShowPreviewOtpScreen() {
    MyBaseTheme {
        OtpScreen(onNavigateToHome = {}, onNavigateToLogin = {})
    }
}