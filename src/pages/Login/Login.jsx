import React, { useState } from 'react';

import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, X } from 'lucide-react';
import landingImg from '../../assets/img.png';

const Login = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const { user, loginWithGoogle, login, register, loading, error } = useAuth();
    const navigate = useNavigate();

    if (!loading && user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleUsernameChange = (e) => setUsername(e.target.value);
    const handlePasswordChange = (e) => setPassword(e.target.value);
    const handleConfirmPasswordChange = (e) => setConfirmPassword(e.target.value);

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setLocalError(null);
        setPassword('');
        setConfirmPassword('');
    };

    const getPasswordRules = (pass) => {
        return {
            length: pass.length >= 8,
            upper: /[A-Z]/.test(pass),
            lower: /[a-z]/.test(pass),
            number: /[0-9]/.test(pass),
            special: /[^A-Za-z0-9]/.test(pass)
        };
    };

    const rules = getPasswordRules(password);
    const rulesPassed = Object.values(rules).filter(Boolean).length;
    let strength = 0;
    let colorClass = 'bg-white/10';
    if (password.length > 0) {
        if (rulesPassed <= 2) { strength = 1; colorClass = 'bg-[#FF6B6B]'; }
        else if (rulesPassed === 3) { strength = 2; colorClass = 'bg-[#FFB067]'; }
        else if (rulesPassed === 4) { strength = 3; colorClass = 'bg-[#FFD166]'; }
        else if (rulesPassed === 5) { strength = 4; colorClass = 'bg-[#87D69B]'; }
    }

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await loginWithGoogle(credentialResponse.credential);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error(err);
        }
    };


    const validatePassword = (pass) => {
        if (pass.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(pass)) return "Must contain at least one uppercase letter.";
        if (!/[a-z]/.test(pass)) return "Must contain at least one lowercase letter.";
        if (!/[0-9]/.test(pass)) return "Must contain at least one number.";
        if (!/[^A-Za-z0-9]/.test(pass)) return "Must contain at least one special character.";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        setFieldErrors({});

        try {
            if (isSignUp) {
                const passError = validatePassword(password);
                if (passError) {
                    setFieldErrors({ password: passError });
                    return;
                }
                
                if (password !== confirmPassword) {
                    setFieldErrors({ confirmPassword: "Passwords do not match" });
                    return;
                }
                await register(username, password);
                navigate('/dashboard', { replace: true });
            } else {
                await login(username, password);
                navigate('/dashboard', { replace: true });
            }
        } catch (error) {
            console.error(error);
            if (error.response?.status === 400 && error.response?.data?.errors) {
                const formErrors = {};
                error.response.data.errors.forEach(err => {
                    formErrors[err.path] = err.msg;
                });
                setFieldErrors(formErrors);
            } else {
                setLocalError(error.response?.data?.message || 'Server error');
            }
        }
    };

    const displayError = localError || error;

    // Animation variants
    const fadeUp = {
        hidden: { opacity: 0, y: 20 },
        visible: (custom) => ({
            opacity: 1,
            y: 0,
            transition: { delay: custom * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
        })
    };

    return (
        <div className="min-h-screen bg-[#111111] text-white font-sans flex flex-col md:flex-row overflow-hidden selection:bg-white/20">
            {/* Left Column: Editorial & Auth */}
            <div className="flex flex-col justify-between w-full md:w-[60%] max-w-3xl px-6 md:px-12 lg:px-20 py-12 md:py-16 mx-auto h-screen overflow-y-auto custom-scrollbar">
                
                {/* Brand / Logo */}
                <motion.div 
                    custom={0} initial="hidden" animate="visible" variants={fadeUp}
                    className="-ml-6 -mt-4 flex items-center"
                >
                    <img src="/kag-z.png" alt="KagZ Logo" className="h-[50px] object-contain -ml-16" />
                </motion.div>

                {/* Hero Text */}
                <div className="mt-16 md:mt-auto mb-12 flex flex-col items-center justify-center text-center">
                    <motion.h1 
                        custom={1} initial="hidden" animate="visible" variants={fadeUp}
                        className="text-2xl sm:text-3xl md:text-[44px] lg:text-[52px] leading-[1.1] text-[#F0EFEC] tracking-tight mb-4 whitespace-nowrap"
                        style={{ fontFamily: "'Lora', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}
                    >
                        Make Knowledge Useful.
                    </motion.h1>
                    
                    <motion.p 
                        custom={2} initial="hidden" animate="visible" variants={fadeUp}
                        className="text-[18px] md:text-[20px] leading-relaxed text-[#F0EFEC]/80"
                        style={{ fontFamily: "'Lora', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" }}
                    >
                        Write it once. Understand it forever.
                    </motion.p>
                </div>


                {/* Authentication Card */}
                <motion.div 
                    custom={3} initial="hidden" animate="visible" variants={fadeUp}
                    className="w-full min-w-[320px] max-w-[500px] bg-[#111111] rounded-[32px] p-8 border-[0.5px] border-white/10 mb-auto text-center mx-auto"
                >
                    {displayError && (
                        <div className="mb-4 text-center text-[13px] font-medium text-[#FF6B6B]">
                            {displayError}
                        </div>
                    )}

                    {/* Google Auth */}
                    <div className="relative w-full h-[40px] rounded-[10px] overflow-hidden bg-white/10 hover:bg-white/[0.15] transition-all duration-150 ease-out mb-3 group cursor-pointer shadow-[inset_0_0_0_1px_transparent,0_1px_2px_0_rgba(0,0,0,0.05)]">
                        {/* Custom Visual (matches the reference image) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg viewBox="0 0 24 24" className="w-[20px] h-[20px] group-hover:scale-105 transition-transform duration-300">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        </div>
                        
                        {/* Invisible actual button */}
                        <div className="absolute inset-0 opacity-[0.01] z-10 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full cursor-pointer">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setLocalError('Google login failed. Please try again.')}
                                useOneTap
                                width="400"
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center justify-center mb-3">
                        <span className="text-[12px] font-medium text-[#F0EFEC]/40 tracking-wider">OR</span>
                    </div>

                    {/* Credentials Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                required
                                disabled={loading}
                                value={username}
                                onChange={handleUsernameChange}
                                placeholder="Enter your username"
                                className={`w-full h-[40px] bg-white/5 border rounded-[10px] px-4 text-[15px] text-[#F0EFEC] placeholder-[#F0EFEC]/20 outline-none transition-all duration-150 ease-out ${fieldErrors.username ? 'border-[#FF6B6B] focus:border-[#FF6B6B]' : 'border-white/10 focus:border-white/20 focus:bg-white/10'}`}
                            />
                            {fieldErrors.username && (
                                <p className="mt-1.5 text-left text-[13px] text-[#FF6B6B]">{fieldErrors.username}</p>
                            )}
                        </div>

                        <div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    disabled={loading}
                                    value={password}
                                    onChange={handlePasswordChange}
                                    placeholder="Enter your password"
                                    className={`w-full h-[40px] bg-white/5 border rounded-[10px] pl-4 pr-12 text-[15px] text-[#F0EFEC] placeholder-[#F0EFEC]/20 outline-none transition-all duration-150 ease-out ${fieldErrors.password ? 'border-[#FF6B6B] focus:border-[#FF6B6B]' : 'border-white/10 focus:border-white/20 focus:bg-white/10'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F0EFEC]/30 hover:text-[#F0EFEC]/60 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {fieldErrors.password && !isSignUp && (
                                <p className="mt-1.5 text-left text-[13px] text-[#FF6B6B]">{fieldErrors.password}</p>
                            )}
                            
                            {isSignUp && password.length > 0 && (
                                <div className="mt-3 flex flex-col gap-2.5">
                                    <div className="flex gap-1.5 h-1.5 w-full">
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${strength >= 1 ? colorClass : 'bg-white/10'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${strength >= 2 ? colorClass : 'bg-white/10'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${strength >= 3 ? colorClass : 'bg-white/10'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${strength >= 4 ? colorClass : 'bg-white/10'}`}></div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1.5 mt-1 text-[12px]">
                                        {!rules.length && (
                                            <div className="flex items-center gap-2 text-white/40">
                                                <X className="w-3.5 h-3.5" /> Minimum 8 characters
                                            </div>
                                        )}
                                        {!rules.upper && (
                                            <div className="flex items-center gap-2 text-white/40">
                                                <X className="w-3.5 h-3.5" /> Uppercase letter
                                            </div>
                                        )}
                                        {!rules.lower && (
                                            <div className="flex items-center gap-2 text-white/40">
                                                <X className="w-3.5 h-3.5" /> Lowercase letter
                                            </div>
                                        )}
                                        {!rules.number && (
                                            <div className="flex items-center gap-2 text-white/40">
                                                <X className="w-3.5 h-3.5" /> Number
                                            </div>
                                        )}
                                        {!rules.special && (
                                            <div className="flex items-center gap-2 text-white/40">
                                                <X className="w-3.5 h-3.5" /> Special character
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <AnimatePresence>
                            {isSignUp && rulesPassed === 5 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="relative mt-4">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            disabled={loading}
                                            value={confirmPassword}
                                            onChange={handleConfirmPasswordChange}
                                            placeholder="Confirm your password"
                                            className={`w-full h-[40px] bg-white/5 border rounded-[10px] pl-4 pr-12 text-[15px] text-[#F0EFEC] placeholder-[#F0EFEC]/20 outline-none transition-all duration-150 ease-out ${fieldErrors.confirmPassword ? 'border-[#FF6B6B] focus:border-[#FF6B6B]' : 'border-white/10 focus:border-white/20 focus:bg-white/10'}`}
                                        />
                                        {fieldErrors.confirmPassword && (
                                            <p className="mt-1.5 text-left text-[13px] text-[#FF6B6B]">{fieldErrors.confirmPassword}</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={loading || !username || !password || (isSignUp && (!confirmPassword || rulesPassed < 5))}
                            className="w-full h-[40px] mt-2 bg-white text-black font-medium text-[15px] rounded-[10px] hover:bg-white/90 active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                            ) : (
                                isSignUp ? 'Create account' : 'Sign in'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-[14px] text-[#F0EFEC]/60">
                        {isSignUp ? "Already have an account?" : "Don't have an account?"}
                        <button 
                            type="button" 
                            onClick={toggleMode} 
                            className="ml-2 text-[#F0EFEC] font-medium hover:underline underline-offset-4 decoration-[#F0EFEC]/30"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </div>
                </motion.div>

            </div>

            {/* Right Column: Visual */}
            <div className="hidden md:flex flex-col w-full md:w-[40%] h-screen relative p-8 lg:py-12 lg:pl-12 lg:pr-32 items-center justify-center">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    className="w-[630px] h-[830px] relative rounded-[20px] overflow-hidden shadow-2xl"
                >
                    <img 
                        src={landingImg} 
                        alt="KagZ Knowledge Workspace" 
                        className="w-full h-full object-cover object-bottom scale-[1.15]"
                    />
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
