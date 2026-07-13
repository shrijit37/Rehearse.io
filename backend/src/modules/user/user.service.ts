import type { GetUserDetails, GetUserValidation } from "./user.validation";
import { User } from "./user.model";

export const getUserDetails = async (data: GetUserValidation): Promise<GetUserDetails> => {
    const user = await User.findOne({ id: data.id });
    const id = data.id;
    try {
        if (!user) {
            return {
                status: 404,
                data: {
                    id: id,
                    email: null,
                    name: null,
                    audio: null,
                    photo: null,
                    resume: null,
                    resumeName: null,
                    onboardingCompleted: false,
                },
                message: "User not found",
            };
        }

        return {
            status: 200,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                audio: user.audio,
                photo: user.photo,
                resume: user.resume,
                resumeName: user.resumeName,
                onboardingCompleted: user.onboardingCompleted,
            },
            message: "User found",
        };
    } catch (error) {
        console.error(error);
        return {
            status: 500,
            data: {
                id: id,
                email: null,
                name: null,
                audio: null,
                photo: null,
                resume: null,
                resumeName: null,
                onboardingCompleted: false,
            },
            message: "Internal Server Error",
        };
    }

}