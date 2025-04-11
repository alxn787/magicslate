'use client';

import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";

type FormData = {
  email: string;
  password: string;
};



const LoginForm = () => {
    const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    router.push(`/room/${email}`)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm mx-auto">
      <div>
        <label className="block mb-1 font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^\S+@\S+$/i,
              message: "Invalid email format",
            },
          })}
          className="w-full p-2 border rounded"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block mb-1 font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register("password", {
            required: "Password is required",
            minLength: {
              value: 6,
              message: "Password must be at least 6 characters",
            },
          })}
          className="w-full p-2 border rounded"
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        {isSubmitting ? "Submitting..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
