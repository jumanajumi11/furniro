import User from '../../models/user.js';


function validateAddress(name, phone, pincode) {
    const phoneRegex = /^\d{10}$/;
    const pinRegex = /^\d{6}$/;

    if (!name || !name.trim()) {
        throw new Error("Name is required");
    }
    if (!phoneRegex.test(phone)) {
        throw new Error("Invalid phone number. Must be 10 digits.");
    }
    if (!pinRegex.test(pincode)) {
        throw new Error("Invalid pincode. Must be 6 digits.");
    }
}


export const addAddress = async (userId, addressData) => {
    const { name, phone, pincode, state, city, locality, house, area, isDefault } = addressData;
    
    validateAddress(name, phone, pincode);

    const isDefaultBool = isDefault === 'on' || isDefault === true;

    const newAddress = {
        name: name.trim(),
        phone: phone.trim(),
        pincode: pincode.trim(),
        state,
        city,
        locality: locality.trim(),
        house: house.trim(),
        area: area.trim(),
        isDefault: isDefaultBool
    };

    if (newAddress.isDefault) {
        await User.updateOne(
            { _id: userId },
            { $set: { "addresses.$[].isDefault": false } }
        );
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { addresses: newAddress } },
        { returnDocument:'after' }
    );

    return updatedUser;
};


export const editAddress = async (userId, addressId, addressData) => {
    const { name, phone, pincode, state, city, locality, house, area, isDefault } = addressData;

    validateAddress(name, phone, pincode);

    const isDefaultBool = isDefault === 'on' || isDefault === true;

    if (isDefaultBool) {
        await User.updateOne(
            { _id: userId },
            { $set: { "addresses.$[].isDefault": false } }
        );
    }

    const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "addresses._id": addressId },
        {
            $set: {
                "addresses.$.name": name.trim(),
                "addresses.$.phone": phone.trim(),
                "addresses.$.pincode": pincode.trim(),
                "addresses.$.state": state,
                "addresses.$.city": city,
                "addresses.$.locality": locality.trim(),
                "addresses.$.house": house.trim(),
                "addresses.$.area": area.trim(),
                "addresses.$.isDefault": isDefaultBool
            }
        },
        { returnDocument:'after' }
    );

    if (!updatedUser) {
        throw new Error("Address or User not found");
    }

    return updatedUser;
};


export const deleteAddress = async (userId, addressId) => {
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { addresses: { _id: addressId } } },
        { returnDocument:'after' }
    );
    return updatedUser;
};


export const getUserAddress = async (userId, addressId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    return user.addresses.id(addressId);
};

export default {
    addAddress,
    editAddress,
    deleteAddress,
    getUserAddress
};
